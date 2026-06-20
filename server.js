const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const masterDataStore = require("./config/master-data");
const kpiCriterionA = require("./kpi/criterion-a");
const kpiCriterionB = require("./kpi/criterion-b");
const kpiCriterionC = require("./kpi/criterion-c");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.join(__dirname, "database.sqlite");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_PATH, (error) => {
    if (error) {
        console.error("Loi ket noi SQLite:", error.message);
    } else {
        console.log("Da ket noi SQLite.");
    }
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function toNumber(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
}

function clampProgress(value) {
    return Math.max(0, Math.min(100, Math.round(toNumber(value, 0))));
}

function getRuntimeConfig() {
    return masterDataStore.getMasterData();
}

function isValidDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function todayIsoDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toDateValue(value) {
    if (!isValidDateString(value)) {
        return null;
    }

    return new Date(`${value}T00:00:00`);
}

function findByCode(items, code) {
    return items.find((item) => item.code === code) || null;
}

function findByName(items, name) {
    const normalizedName = normalizeText(name).toLowerCase();
    return items.find((item) => normalizeText(item.name).toLowerCase() === normalizedName) || null;
}

function mapLegacyStatus(status, dueDate) {
    const normalizedStatus = normalizeText(status).toLowerCase();
    if (normalizedStatus.includes("hoan thanh")) {
        return normalizedStatus.includes("cham") ? "delayed" : "done";
    }

    if (normalizedStatus.includes("cham")) {
        return "in_progress";
    }

    return "in_progress";
}

function formatTask(task) {
    const masterData = getRuntimeConfig();
    const dueDateValue = toDateValue(task.due_date);
    const todayValue = toDateValue(todayIsoDate());
    const isCompleted = task.status_code === "done" || task.status_code === "delayed";
    const isDelayed = task.status_code === "delayed";
    const isOverdue = !isCompleted && dueDateValue && todayValue && dueDateValue < todayValue;
    const displayStatusCode = task.status_code;
    const displayStatus = masterData.taskStatusLookup[displayStatusCode] || {
        code: displayStatusCode,
        name: task.status_code
    };

    return kpiCriterionA.attachKpiAMetadata({
        ...task,
        display_status_code: displayStatus.code,
        display_status_name: displayStatus.name,
        is_delayed: Boolean(isDelayed),
        is_done: isCompleted,
        is_completed: isCompleted,
        is_overdue: Boolean(isOverdue)
    }, masterData.generalSettings?.kpiStartDay || 1);
}

async function createTasksTable() {
    await run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            assigner_code TEXT NOT NULL,
            assigner_name TEXT NOT NULL,
            unit_code TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            authority_name TEXT DEFAULT '',
            priority_code TEXT NOT NULL DEFAULT 'normal',
            status_code TEXT NOT NULL DEFAULT 'in_progress',
            progress_percent INTEGER NOT NULL DEFAULT 0,
            expected_result TEXT DEFAULT '',
            latest_update TEXT DEFAULT '',
            latest_issue TEXT DEFAULT '',
            quality_band TEXT,
            quality_score REAL,
            schedule_band TEXT DEFAULT 'on_time',
            schedule_score REAL DEFAULT 1,
            due_date TEXT NOT NULL,
            completed_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run("CREATE INDEX IF NOT EXISTS idx_tasks_assigner_code ON tasks(assigner_code)");
    await run("CREATE INDEX IF NOT EXISTS idx_tasks_unit_code ON tasks(unit_code)");
    await run("CREATE INDEX IF NOT EXISTS idx_tasks_owner_name ON tasks(owner_name)");
    await run("CREATE INDEX IF NOT EXISTS idx_tasks_status_code ON tasks(status_code)");
    await run("CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)");
}

async function ensureTaskColumns() {
    const columns = await all("PRAGMA table_info(tasks)");
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("authority_name")) {
        await run("ALTER TABLE tasks ADD COLUMN authority_name TEXT DEFAULT ''");
    }

    if (!columnNames.has("quality_band")) {
        await run("ALTER TABLE tasks ADD COLUMN quality_band TEXT");
    }

    if (!columnNames.has("quality_score")) {
        await run("ALTER TABLE tasks ADD COLUMN quality_score REAL");
    }

    if (!columnNames.has("schedule_band")) {
        await run("ALTER TABLE tasks ADD COLUMN schedule_band TEXT DEFAULT 'on_time'");
    }

    if (!columnNames.has("schedule_score")) {
        await run("ALTER TABLE tasks ADD COLUMN schedule_score REAL DEFAULT 1");
    }

    await run("UPDATE tasks SET schedule_band = 'on_time' WHERE schedule_band IS NULL OR TRIM(schedule_band) = ''");
    await run("UPDATE tasks SET schedule_score = 1 WHERE schedule_score IS NULL");
}

async function normalizeTaskStatusesForImplementationRules() {
    await run(`
        UPDATE tasks
        SET
            status_code = 'in_progress',
            quality_band = 'standard',
            quality_score = 1,
            schedule_band = 'on_time',
            schedule_score = 1,
            completed_at = NULL
        WHERE status_code = 'delayed' AND (completed_at IS NULL OR TRIM(completed_at) = '')
    `);

    await run(`
        UPDATE tasks
        SET
            status_code = 'delayed',
            completed_at = COALESCE(NULLIF(TRIM(completed_at), ''), updated_at, created_at, CURRENT_TIMESTAMP)
        WHERE status_code = 'done' AND schedule_band NOT IN ('ahead', 'on_time')
    `);
}

async function findNextAvailableTableName(baseName) {
    let tableName = baseName;
    let suffix = 1;

    while (await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName])) {
        tableName = `${baseName}_${suffix}`;
        suffix += 1;
    }

    return tableName;
}

async function migrateLegacyTasksIfNeeded() {
    const tableInfo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'");
    if (!tableInfo) {
        return;
    }

    const columns = await all("PRAGMA table_info(tasks)");
    const hasNewSchema = columns.some((column) => column.name === "assigner_code");
    if (hasNewSchema) {
        return;
    }

    const legacyTableName = await findNextAvailableTableName("tasks_legacy");
    await run(`ALTER TABLE tasks RENAME TO ${legacyTableName}`);
    await createTasksTable();

    const legacyRows = await all(`SELECT * FROM ${legacyTableName} ORDER BY id ASC`);
    const masterData = getRuntimeConfig();

    for (const legacyTask of legacyRows) {
        const assigner = findByName(masterData.assigners, legacyTask.assigner) || {
            code: slugify(legacyTask.assigner || "khac"),
            name: normalizeText(legacyTask.assigner || "Khac")
        };
        const unit = findByName(masterData.orgUnits, legacyTask.unit) || {
            code: slugify(legacyTask.unit || "khac"),
            name: normalizeText(legacyTask.unit || "Khac")
        };
        const statusCode = mapLegacyStatus(legacyTask.status, legacyTask.deadline);
        const progressPercent = statusCode === "done" ? 100 : normalizeText(legacyTask.progress) ? 50 : 0;

        await run(
            `
            INSERT INTO tasks (
                title,
                assigner_code,
                assigner_name,
                unit_code,
                unit_name,
                owner_name,
                authority_name,
                priority_code,
                status_code,
                progress_percent,
                expected_result,
                latest_update,
                latest_issue,
                due_date,
                completed_at,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                normalizeText(legacyTask.name || "Cong viec chua dat ten"),
                assigner.code,
                assigner.name,
                unit.code,
                unit.name,
                normalizeText(legacyTask.owner || "Chua cap nhat"),
                normalizeText(legacyTask.authority || ""),
                "normal",
                statusCode,
                progressPercent,
                normalizeText(legacyTask.result || ""),
                normalizeText(legacyTask.progress || ""),
                normalizeText(legacyTask.notes || ""),
                legacyTask.deadline || todayIsoDate(),
                statusCode === "done" ? legacyTask.updated_at || legacyTask.created_at : null,
                legacyTask.created_at || new Date().toISOString(),
                legacyTask.updated_at || legacyTask.created_at || new Date().toISOString()
            ]
        );
    }
}

async function initializeDatabase() {
    await run("PRAGMA foreign_keys = ON");
    await migrateLegacyTasksIfNeeded();
    await createTasksTable();
    await ensureTaskColumns();
    await normalizeTaskStatusesForImplementationRules();
}

function validateTaskPayload(payload, currentTask = null) {
    const masterData = getRuntimeConfig();
    const title = normalizeText(payload.title);
    const assignerCode = normalizeText(payload.assigner_code);
    const unitCode = normalizeText(payload.unit_code);
    const ownerName = normalizeText(payload.owner_name);
    const authorityName = normalizeText(payload.authority_name || "");
    const dueDate = normalizeText(payload.due_date);
    const priorityCode = normalizeText(payload.priority_code || "normal");
    const statusCode = normalizeText(payload.status_code || "in_progress");
    const expectedResult = normalizeText(payload.expected_result || "");
    const latestUpdate = normalizeText(payload.latest_update || "");
    const latestIssue = normalizeText(payload.latest_issue || "");
    const qualityBand = normalizeText(payload.quality_band || "");
    const qualityScoreRaw = payload.quality_score;
    const scheduleBand = normalizeText(payload.schedule_band || "");
    const scheduleScoreRaw = payload.schedule_score;
    const progressPercent = clampProgress(payload.progress_percent);

    if (!title || !assignerCode || !unitCode || !ownerName || !dueDate) {
        return {
            error: "Vui long nhap day du ten cong viec, cap giao viec, don vi, ca nhan phu trach va han hoan thanh."
        };
    }

    if (!isValidDateString(dueDate)) {
        return {
            error: "Han hoan thanh khong dung dinh dang YYYY-MM-DD."
        };
    }

    const assigner = findByCode(masterData.assigners, assignerCode);
    if (!assigner) {
        return {
            error: "Cap giao viec khong hop le."
        };
    }

    if (assigner.disabled && (!currentTask || currentTask.assigner_code !== assigner.code)) {
        return {
            error: "Cap giao viec da ngung su dung."
        };
    }

    const unit = findByCode(masterData.orgUnits, unitCode);
    if (!unit) {
        return {
            error: "Don vi chu tri khong hop le."
        };
    }

    if (unit.disabled && (!currentTask || currentTask.unit_code !== unit.code)) {
        return {
            error: "Don vi chu tri da ngung su dung."
        };
    }

    if (!findByCode(masterData.taskStatuses, statusCode)) {
        return {
            error: "Trang thai khong hop le."
        };
    }

    if (!findByCode(masterData.priorityLevels, priorityCode)) {
        return {
            error: "Muc uu tien khong hop le."
        };
    }

    const qualityValidationError = kpiCriterionB.validateQualityFields({
        status_code: statusCode,
        quality_band: qualityBand,
        quality_score: qualityScoreRaw
    });

    if (qualityValidationError) {
        return {
            error: qualityValidationError
        };
    }

    const scheduleValidationError = kpiCriterionC.validateScheduleFields({
        status_code: statusCode,
        schedule_band: scheduleBand,
        schedule_score: scheduleScoreRaw
    });

    if (scheduleValidationError) {
        return {
            error: scheduleValidationError
        };
    }

    const isCompletedStatus = statusCode === "done" || statusCode === "delayed";
    const qualityScore = isCompletedStatus
        ? Math.round(Number(qualityScoreRaw) * 100) / 100
        : 1;
    const scheduleScore = isCompletedStatus
        ? Math.round(Number(scheduleScoreRaw) * 100) / 100
        : 1;

    return {
        value: {
            title,
            assigner_code: assigner.code,
            assigner_name: assigner.name,
            unit_code: unit.code,
            unit_name: unit.name,
            owner_name: ownerName,
            authority_name: authorityName,
            priority_code: priorityCode,
            status_code: statusCode,
            progress_percent: progressPercent,
            expected_result: expectedResult,
            latest_update: latestUpdate,
            latest_issue: latestIssue,
            quality_band: isCompletedStatus ? qualityBand : "standard",
            quality_score: qualityScore,
            schedule_band: isCompletedStatus ? scheduleBand : "on_time",
            schedule_score: scheduleScore,
            due_date: dueDate,
            completed_at: isCompletedStatus
                ? currentTask?.completed_at || new Date().toISOString()
                : null
        }
    };
}

function normalizeAssignersPayload(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        code: normalizeText(item.code),
        name: normalizeText(item.name),
        disabled: Boolean(item.disabled)
    }));
}

function validateAssignersPayload(items, currentItems) {
    if (!items.length) {
        return "Danh muc lanh dao giao viec khong duoc de trong.";
    }

    const currentCodes = new Set(currentItems.map((item) => item.code));
    const nextCodes = new Set();

    for (const item of items) {
        if (!item.code || !item.name) {
            return "Moi lanh dao giao viec phai co du ten va ma lanh dao.";
        }

        if (nextCodes.has(item.code)) {
            return `Ma lanh dao bi trung: ${item.code}.`;
        }

        nextCodes.add(item.code);
    }

    for (const code of currentCodes) {
        if (!nextCodes.has(code)) {
            return `Khong duoc xoa lanh dao da ton tai: ${code}.`;
        }
    }

    return null;
}

function normalizeOrgUnitsPayload(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        code: normalizeText(item.code),
        name: normalizeText(item.name),
        head_name: normalizeText(item.head_name),
        head_title: normalizeText(item.head_title),
        head_rank: normalizeText(item.head_rank),
        disabled: Boolean(item.disabled)
    }));
}

function validateOrgUnitsPayload(items, currentItems) {
    if (!items.length) {
        return "Danh mục đơn vị trực thuộc không được để trống.";
    }

    const currentCodes = new Set(currentItems.map((item) => item.code));
    const nextCodes = new Set();

    for (const item of items) {
        if (!item.code || !item.name || !item.head_name || !item.head_title || !item.head_rank) {
            return "Mỗi đơn vị phải có đủ tên đơn vị, mã đơn vị, người đứng đầu, chức vụ và cấp bậc.";
        }

        if (nextCodes.has(item.code)) {
            return `Mã đơn vị bị trùng: ${item.code}.`;
        }

        nextCodes.add(item.code);
    }

    for (const code of currentCodes) {
        if (!nextCodes.has(code)) {
            return `Không được xóa đơn vị đã tồn tại: ${code}.`;
        }
    }

    return null;
}

function normalizeGeneralSettingsPayload(payload) {
    return {
        kpiStartDay: Math.round(toNumber(payload?.kpiStartDay, 1))
    };
}

function validateGeneralSettingsPayload(settings) {
    if (!Number.isInteger(settings.kpiStartDay) || settings.kpiStartDay < 1 || settings.kpiStartDay > 31) {
        return "Ngày bắt đầu tính KPI của tháng phải nằm trong khoảng từ 1 đến 31.";
    }

    return null;
}

async function getTaskById(taskId) {
    const task = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    return task ? formatTask(task) : null;
}

app.get("/api/health", (request, response) => {
    response.json({
        ok: true,
        message: "He thong dang hoat dong"
    });
});

app.get("/api/config", (request, response) => {
    response.json({
        ...getRuntimeConfig(),
        kpiBOptions: kpiCriterionB.getQualityBandOptions(),
        kpiCOptions: kpiCriterionC.getScheduleBandOptions()
    });
});

app.get("/api/settings/org-units", (request, response) => {
    response.json({
        orgUnits: getRuntimeConfig().orgUnits
    });
});

app.get("/api/settings/assigners", (request, response) => {
    response.json({
        assigners: getRuntimeConfig().assigners
    });
});

app.get("/api/settings/general", (request, response) => {
    response.json({
        generalSettings: getRuntimeConfig().generalSettings
    });
});

app.put("/api/settings/org-units", async (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const nextOrgUnits = normalizeOrgUnitsPayload(request.body.orgUnits);
        const validationError = validateOrgUnitsPayload(nextOrgUnits, currentConfig.orgUnits);

        if (validationError) {
            response.status(400).json({ message: validationError });
            return;
        }

        const nextConfig = masterDataStore.saveMasterData({
            generalSettings: currentConfig.generalSettings,
            assigners: currentConfig.assigners,
            orgUnits: nextOrgUnits,
            taskStatuses: currentConfig.taskStatuses,
            priorityLevels: currentConfig.priorityLevels
        });

        for (const unit of nextConfig.orgUnits) {
            await run(
                "UPDATE tasks SET unit_name = ?, updated_at = updated_at WHERE unit_code = ?",
                [unit.name, unit.code]
            );
        }

        response.json({
            message: "Đã cập nhật danh sách đơn vị trực thuộc.",
            orgUnits: nextConfig.orgUnits
        });
    } catch (error) {
        response.status(500).json({
            message: "Không thể cập nhật danh sách đơn vị trực thuộc.",
            error: error.message
        });
    }
});

app.put("/api/settings/assigners", async (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const nextAssigners = normalizeAssignersPayload(request.body.assigners);
        const validationError = validateAssignersPayload(nextAssigners, currentConfig.assigners);

        if (validationError) {
            response.status(400).json({ message: validationError });
            return;
        }

        const nextConfig = masterDataStore.saveMasterData({
            generalSettings: currentConfig.generalSettings,
            assigners: nextAssigners,
            orgUnits: currentConfig.orgUnits,
            taskStatuses: currentConfig.taskStatuses,
            priorityLevels: currentConfig.priorityLevels
        });

        for (const assigner of nextConfig.assigners) {
            await run(
                "UPDATE tasks SET assigner_name = ?, updated_at = updated_at WHERE assigner_code = ?",
                [assigner.name, assigner.code]
            );
        }

        response.json({
            message: "Da cap nhat danh sach lanh dao giao viec.",
            assigners: nextConfig.assigners
        });
    } catch (error) {
        response.status(500).json({
            message: "Khong the cap nhat danh sach lanh dao giao viec.",
            error: error.message
        });
    }
});

app.put("/api/settings/general", (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const nextGeneralSettings = normalizeGeneralSettingsPayload(request.body || {});
        const validationError = validateGeneralSettingsPayload(nextGeneralSettings);

        if (validationError) {
            response.status(400).json({ message: validationError });
            return;
        }

        const nextConfig = masterDataStore.saveMasterData({
            generalSettings: nextGeneralSettings,
            assigners: currentConfig.assigners,
            orgUnits: currentConfig.orgUnits,
            taskStatuses: currentConfig.taskStatuses,
            priorityLevels: currentConfig.priorityLevels
        });

        response.json({
            message: "Đã cập nhật cài đặt chung.",
            generalSettings: nextConfig.generalSettings
        });
    } catch (error) {
        response.status(500).json({
            message: "Không thể cập nhật cài đặt chung.",
            error: error.message
        });
    }
});

app.get("/api/tasks", async (request, response) => {
    try {
        const {
            search = "",
            assigner_code = "",
            unit_code = "",
            status_code = "",
            priority_code = "",
            owner_name = "",
            due_state = ""
        } = request.query;

        const rows = await all("SELECT * FROM tasks ORDER BY due_date ASC, updated_at DESC");
        let tasks = rows.map(formatTask);

        const normalizedSearch = normalizeText(search).toLowerCase();
        if (normalizedSearch) {
            tasks = tasks.filter((task) =>
                [
                    task.title,
                    task.assigner_name,
                    task.unit_name,
                    task.owner_name,
                    task.authority_name,
                    task.expected_result,
                    task.latest_update,
                    task.latest_issue
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedSearch)
            );
        }

        if (assigner_code) {
            tasks = tasks.filter((task) => task.assigner_code === assigner_code);
        }

        if (unit_code) {
            tasks = tasks.filter((task) => task.unit_code === unit_code);
        }

        if (status_code) {
            tasks = tasks.filter((task) => task.status_code === status_code);
        }

        if (priority_code) {
            tasks = tasks.filter((task) => task.priority_code === priority_code);
        }

        if (owner_name) {
            const normalizedOwner = normalizeText(owner_name).toLowerCase();
            tasks = tasks.filter((task) => task.owner_name.toLowerCase().includes(normalizedOwner));
        }

        if (due_state === "due_today") {
            const today = todayIsoDate();
            tasks = tasks.filter((task) => task.due_date === today);
        } else if (due_state === "overdue") {
            tasks = tasks.filter((task) => task.is_overdue);
        } else if (due_state === "upcoming") {
            const today = todayIsoDate();
            tasks = tasks.filter((task) => !task.is_completed && task.due_date >= today);
        }

        response.json(tasks);
    } catch (error) {
        response.status(500).json({
            message: "Khong the lay danh sach cong viec.",
            error: error.message
        });
    }
});

app.get("/api/kpi/a/summary", async (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const kpiStartDay = Number(currentConfig.generalSettings?.kpiStartDay) || 1;
        const {
            month = "",
            assigner_code = "",
            unit_code = ""
        } = request.query;

        const resolvedMonth = /^\d{4}-\d{2}$/.test(String(month || ""))
            ? String(month)
            : kpiCriterionA.getKpiMonthValueFromDate(todayIsoDate(), kpiStartDay);

        const rows = await all("SELECT * FROM tasks ORDER BY due_date ASC, updated_at DESC");
        const tasks = rows.map(formatTask);

        response.json(kpiCriterionA.buildKpiASummary({
            tasks,
            orgUnits: currentConfig.orgUnits,
            month: resolvedMonth,
            assignerCode: normalizeText(assigner_code),
            unitCode: normalizeText(unit_code),
            kpiStartDay
        }));
    } catch (error) {
        response.status(500).json({
            message: "Khong the tong hop KPI A theo thang.",
            error: error.message
        });
    }
});

app.get("/api/kpi/b/summary", async (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const kpiStartDay = Number(currentConfig.generalSettings?.kpiStartDay) || 1;
        const {
            month = "",
            assigner_code = "",
            unit_code = ""
        } = request.query;

        const resolvedMonth = /^\d{4}-\d{2}$/.test(String(month || ""))
            ? String(month)
            : kpiCriterionA.getKpiMonthValueFromDate(todayIsoDate(), kpiStartDay);

        const rows = await all("SELECT * FROM tasks ORDER BY due_date ASC, updated_at DESC");
        const tasks = rows.map(formatTask);

        response.json(kpiCriterionB.buildKpiBSummary({
            tasks,
            orgUnits: currentConfig.orgUnits,
            month: resolvedMonth,
            assignerCode: normalizeText(assigner_code),
            unitCode: normalizeText(unit_code),
            kpiStartDay
        }));
    } catch (error) {
        response.status(500).json({
            message: "Khong the tong hop KPI B theo thang.",
            error: error.message
        });
    }
});

app.get("/api/kpi/c/summary", async (request, response) => {
    try {
        const currentConfig = getRuntimeConfig();
        const kpiStartDay = Number(currentConfig.generalSettings?.kpiStartDay) || 1;
        const {
            month = "",
            assigner_code = "",
            unit_code = ""
        } = request.query;

        const resolvedMonth = /^\d{4}-\d{2}$/.test(String(month || ""))
            ? String(month)
            : kpiCriterionA.getKpiMonthValueFromDate(todayIsoDate(), kpiStartDay);

        const rows = await all("SELECT * FROM tasks ORDER BY due_date ASC, updated_at DESC");
        const tasks = rows.map(formatTask);

        response.json(kpiCriterionC.buildKpiCSummary({
            tasks,
            orgUnits: currentConfig.orgUnits,
            month: resolvedMonth,
            assignerCode: normalizeText(assigner_code),
            unitCode: normalizeText(unit_code),
            kpiStartDay
        }));
    } catch (error) {
        response.status(500).json({
            message: "Khong the tong hop KPI C theo thang.",
            error: error.message
        });
    }
});

app.post("/api/tasks", async (request, response) => {
    try {
        const validation = validateTaskPayload(request.body);
        if (validation.error) {
            response.status(400).json({ message: validation.error });
            return;
        }

        const task = validation.value;
        const result = await run(
            `
            INSERT INTO tasks (
                title,
                assigner_code,
                assigner_name,
                unit_code,
                unit_name,
                owner_name,
                authority_name,
                priority_code,
                status_code,
                progress_percent,
                expected_result,
                latest_update,
                latest_issue,
                quality_band,
                quality_score,
                schedule_band,
                schedule_score,
                due_date,
                completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                task.title,
                task.assigner_code,
                task.assigner_name,
                task.unit_code,
                task.unit_name,
                task.owner_name,
                task.authority_name,
                task.priority_code,
                task.status_code,
                task.progress_percent,
                task.expected_result,
                task.latest_update,
                task.latest_issue,
                task.quality_band,
                task.quality_score,
                task.schedule_band,
                task.schedule_score,
                task.due_date,
                task.completed_at
            ]
        );

        const createdTask = await getTaskById(result.lastID);
        response.status(201).json({
            message: "Da tao cong viec moi.",
            task: createdTask
        });
    } catch (error) {
        response.status(500).json({
            message: "Khong the tao cong viec.",
            error: error.message
        });
    }
});

app.put("/api/tasks/:id", async (request, response) => {
    try {
        const taskId = Number(request.params.id);
        const existingTask = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);

        if (!existingTask) {
            response.status(404).json({
                message: "Khong tim thay cong viec can cap nhat."
            });
            return;
        }

        const validation = validateTaskPayload(request.body, existingTask);
        if (validation.error) {
            response.status(400).json({ message: validation.error });
            return;
        }

        const task = validation.value;
        await run(
            `
            UPDATE tasks
            SET
                title = ?,
                assigner_code = ?,
                assigner_name = ?,
                unit_code = ?,
                unit_name = ?,
                owner_name = ?,
                authority_name = ?,
                priority_code = ?,
                status_code = ?,
                progress_percent = ?,
                expected_result = ?,
                latest_update = ?,
                latest_issue = ?,
                quality_band = ?,
                quality_score = ?,
                schedule_band = ?,
                schedule_score = ?,
                due_date = ?,
                completed_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                task.title,
                task.assigner_code,
                task.assigner_name,
                task.unit_code,
                task.unit_name,
                task.owner_name,
                task.authority_name,
                task.priority_code,
                task.status_code,
                task.progress_percent,
                task.expected_result,
                task.latest_update,
                task.latest_issue,
                task.quality_band,
                task.quality_score,
                task.schedule_band,
                task.schedule_score,
                task.due_date,
                task.completed_at,
                taskId
            ]
        );

        const updatedTask = await getTaskById(taskId);
        response.json({
            message: "Da cap nhat cong viec.",
            task: updatedTask
        });
    } catch (error) {
        response.status(500).json({
            message: "Khong the cap nhat cong viec.",
            error: error.message
        });
    }
});

app.delete("/api/tasks/:id", async (request, response) => {
    try {
        const taskId = Number(request.params.id);
        const result = await run("DELETE FROM tasks WHERE id = ?", [taskId]);

        if (!result.changes) {
            response.status(404).json({
                message: "Khong tim thay cong viec de xoa."
            });
            return;
        }

        response.json({
            message: "Da xoa cong viec."
        });
    } catch (error) {
        response.status(500).json({
            message: "Khong the xoa cong viec.",
            error: error.message
        });
    }
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server dang chay tai http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Khoi tao du lieu that bai:", error.message);
        process.exit(1);
    });
