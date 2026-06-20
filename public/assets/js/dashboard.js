(async function initDashboardPage() {
    const state = {
        config: null,
        tasks: [],
        kpiASummary: null,
        kpiBSummary: null,
        kpiCSummary: null
    };

    const rawDocument = document.getElementById("rawDocument");
    const analyzeDocumentButton = document.getElementById("analyzeDocumentButton");
    const monthFilter = document.getElementById("monthFilter");
    const assignerFilter = document.getElementById("assignerFilter");
    const unitFilter = document.getElementById("unitFilter");
    const exportExcelButton = document.getElementById("exportExcelButton");
    const formTitle = document.getElementById("formTitle");
    const editTaskId = document.getElementById("editTaskId");
    const taskAssigner = document.getElementById("taskAssigner");
    const taskName = document.getElementById("taskName");
    const taskUnit = document.getElementById("taskUnit");
    const taskDeadline = document.getElementById("taskDeadline");
    const taskResult = document.getElementById("taskResult");
    const taskOwner = document.getElementById("taskOwner");
    const taskAuthority = document.getElementById("taskAuthority");
    const taskStatus = document.getElementById("taskStatus");
    const taskProgressUpdate = document.getElementById("taskProgressUpdate");
    const taskNotes = document.getElementById("taskNotes");
    const taskDetailFields = document.getElementById("taskDetailFields");
    const taskQualityFields = document.getElementById("taskQualityFields");
    const taskQualityBand = document.getElementById("taskQualityBand");
    const taskQualityScorePercent = document.getElementById("taskQualityScorePercent");
    const taskScheduleFields = document.getElementById("taskScheduleFields");
    const taskScheduleBand = document.getElementById("taskScheduleBand");
    const taskScheduleScorePercent = document.getElementById("taskScheduleScorePercent");
    const formActions = document.getElementById("formActions");
    const summaryTableBody = document.getElementById("summaryTableBody");
    const taskTableBody = document.getElementById("taskTableBody");
    const totalTasks = document.getElementById("total-tasks");
    const doneTasks = document.getElementById("done-tasks");
    const pendingTasks = document.getElementById("pending-tasks");
    const delayedTasks = document.getElementById("delayed-tasks");

    function formatDate(dateString) {
        if (!dateString) {
            return "-";
        }

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return dateString;
        }

        return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    }

    function todayValue() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }

    function getCurrentMonthValue() {
        const now = new Date();
        const kpiStartDay = Number(state.config?.generalSettings?.kpiStartDay) || 1;
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();

        if (currentDay >= kpiStartDay) {
            return `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
        }

        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
    }

    function getTaskMonthValue(task) {
        if (task.kpi_month) {
            return task.kpi_month;
        }

        const dateSource = task.due_date || task.completed_at || task.updated_at || task.created_at;
        if (!dateSource) {
            return "";
        }

        const date = new Date(dateSource);
        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    function getMonthFilterLabel(value) {
        if (!value || !/^\d{4}-\d{2}$/.test(value)) {
            return "Tháng hiện tại";
        }

        const [year, month] = value.split("-");
        return `Tháng ${Number(month)}/${year}`;
    }

    function formatKpiAScore(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "0";
        }

        return numericValue.toLocaleString("vi-VN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    function calculateFinalKpiScore(kpiAScore, kpiBScore, kpiCScore) {
        const scoreA = Number(kpiAScore) || 0;
        const scoreB = Number(kpiBScore) || 0;
        const scoreC = Number(kpiCScore) || 0;
        return ((scoreA + scoreB + scoreC) * 100) / 3;
    }

    function denormalizeQualityScore(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "";
        }

        return String(Math.round(numericValue * 100));
    }

    function normalizeQualityPercent(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return null;
        }

        return Math.round(numericValue) / 100;
    }

    function getQualityBandOptions() {
        return Array.isArray(state.config?.kpiBOptions) ? state.config.kpiBOptions : [];
    }

    function getQualityBandConfig(code) {
        return getQualityBandOptions().find((item) => item.code === code) || null;
    }

    function applyQualityFieldLabels() {
        const qualityBandLabel = document.querySelector('label[for="taskQualityBand"]');
        const qualityScoreLabel = document.querySelector('label[for="taskQualityScorePercent"]');

        if (qualityBandLabel) {
            qualityBandLabel.textContent = "CHẤT LƯỢNG";
        }

        if (qualityScoreLabel) {
            qualityScoreLabel.textContent = "ĐIỂM CHẤT LƯỢNG (%)";
        }

        taskQualityScorePercent.placeholder = "Nhập điểm %";
    }

    function renderQualityBandOptions(selectedCode = "") {
        const options = getQualityBandOptions();
        taskQualityBand.innerHTML = options
            .map((item) => `<option value="${item.code}"${item.code === selectedCode ? " selected" : ""}>${App.escapeHtml(item.label)}</option>`)
            .join("");
    }

    function requiresCompletedCriteria(statusCode = taskStatus.value) {
        return statusCode === "done" || statusCode === "delayed";
    }

    function resetQualityFields() {
        taskQualityFields.hidden = true;
        taskQualityBand.value = "standard";
        taskQualityScorePercent.value = "100";
        taskQualityScorePercent.min = "0";
        taskQualityScorePercent.max = "120";
        taskQualityScorePercent.disabled = false;
    }

    function applyQualityBandConfig(preserveCurrentValue = false) {
        const config = getQualityBandConfig(taskQualityBand.value);
        if (!config) {
            taskQualityScorePercent.value = "";
            taskQualityScorePercent.disabled = false;
            return;
        }

        taskQualityScorePercent.min = String(config.min_percent);
        taskQualityScorePercent.max = String(config.max_percent);
        taskQualityScorePercent.placeholder = `${config.min_percent}-${config.max_percent}`;
        taskQualityScorePercent.disabled = Boolean(config.locked);

        const currentValue = Number(taskQualityScorePercent.value);
        const isCurrentValueValid = Number.isFinite(currentValue)
            && currentValue >= config.min_percent
            && currentValue <= config.max_percent;

        if (!preserveCurrentValue || !isCurrentValueValid) {
            taskQualityScorePercent.value = String(config.default_percent);
        }
    }

    function syncQualityFieldsWithStatus(preserveCurrentValue = false) {
        if (!requiresCompletedCriteria()) {
            resetQualityFields();
            return;
        }

        taskQualityFields.hidden = false;
        if (!taskQualityBand.innerHTML.trim()) {
            renderQualityBandOptions("standard");
        }

        if (!taskQualityBand.value) {
            taskQualityBand.value = "standard";
        }

        applyQualityBandConfig(preserveCurrentValue);
    }

    function applyKpiFieldLabels() {
        applyQualityFieldLabels();

        const qualityBandLabel = document.querySelector('label[for="taskQualityBand"]');
        const qualityScoreLabel = document.querySelector('label[for="taskQualityScorePercent"]');
        const scheduleBandLabel = document.querySelector('label[for="taskScheduleBand"]');
        const scheduleScoreLabel = document.querySelector('label[for="taskScheduleScorePercent"]');

        if (qualityBandLabel) {
            qualityBandLabel.textContent = "CHẤT LƯỢNG";
        }

        if (qualityScoreLabel) {
            qualityScoreLabel.textContent = "ĐIỂM CHẤT LƯỢNG (%)";
        }

        if (scheduleBandLabel) {
            scheduleBandLabel.textContent = "TIẾN ĐỘ / NHẮC NHỞ";
        }

        if (scheduleScoreLabel) {
            scheduleScoreLabel.textContent = "ĐIỂM KPI-C (%)";
        }

        if (taskQualityScorePercent) {
            taskQualityScorePercent.placeholder = "Nhập điểm %";
        }

        if (taskScheduleScorePercent) {
            taskScheduleScorePercent.placeholder = "Nhập điểm %";
        }
    }

    function denormalizeScheduleScore(value) {
        if (value === null || value === undefined || value === "") {
            return "";
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "";
        }

        return String(Math.round(numericValue * 100));
    }

    function normalizeSchedulePercent(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return null;
        }

        return Math.round(numericValue) / 100;
    }

    function getScheduleBandOptions() {
        return Array.isArray(state.config?.kpiCOptions) ? state.config.kpiCOptions : [];
    }

    function getScheduleBandOptionsForStatus(statusCode) {
        const options = getScheduleBandOptions();
        if (statusCode === "done") {
            return options.filter((item) => item.code === "ahead" || item.code === "on_time");
        }

        if (statusCode === "delayed") {
            return options.filter((item) => item.code !== "ahead" && item.code !== "on_time");
        }

        return options.filter((item) => item.code === "on_time");
    }

    function getScheduleBandConfig(code) {
        return getScheduleBandOptions().find((item) => item.code === code) || null;
    }

    function getDefaultScheduleBandForStatus(statusCode) {
        return statusCode === "delayed" ? "remind_1" : "on_time";
    }

    function isScheduleBandAllowedForStatus(statusCode, bandCode) {
        return getScheduleBandOptionsForStatus(statusCode).some((item) => item.code === bandCode);
    }

    function renderScheduleBandOptions(selectedCode = "", statusCode = taskStatus.value) {
        const options = getScheduleBandOptionsForStatus(statusCode);
        const resolvedSelectedCode = isScheduleBandAllowedForStatus(statusCode, selectedCode)
            ? selectedCode
            : (options[0]?.code || "");
        taskScheduleBand.innerHTML = options
            .map((item) => `<option value="${item.code}"${item.code === resolvedSelectedCode ? " selected" : ""}>${App.escapeHtml(item.label)}</option>`)
            .join("");
    }

    function resetScheduleFields() {
        taskScheduleFields.hidden = true;
        renderScheduleBandOptions("on_time", "in_progress");
        taskScheduleBand.value = "on_time";
        taskScheduleScorePercent.value = "100";
        taskScheduleScorePercent.min = "0";
        taskScheduleScorePercent.max = "120";
        taskScheduleScorePercent.disabled = false;
    }

    function applyScheduleBandConfig(preserveCurrentValue = false) {
        const config = getScheduleBandConfig(taskScheduleBand.value);
        if (!config) {
            taskScheduleScorePercent.value = "";
            taskScheduleScorePercent.disabled = false;
            return;
        }

        taskScheduleScorePercent.min = String(config.min_percent);
        taskScheduleScorePercent.max = String(config.max_percent);
        taskScheduleScorePercent.placeholder = `${config.min_percent}-${config.max_percent}`;
        taskScheduleScorePercent.disabled = Boolean(config.locked);

        const currentValue = Number(taskScheduleScorePercent.value);
        const isCurrentValueValid = Number.isFinite(currentValue)
            && currentValue >= config.min_percent
            && currentValue <= config.max_percent;

        if (!preserveCurrentValue || !isCurrentValueValid) {
            taskScheduleScorePercent.value = String(config.default_percent);
        }
    }

    function syncScheduleFieldsWithStatus(preserveCurrentValue = false) {
        if (!requiresCompletedCriteria()) {
            resetScheduleFields();
            return;
        }

        taskScheduleFields.hidden = false;
        const preferredBand = taskScheduleBand.value || getDefaultScheduleBandForStatus(taskStatus.value);
        renderScheduleBandOptions(preferredBand, taskStatus.value);

        if (!isScheduleBandAllowedForStatus(taskStatus.value, taskScheduleBand.value)) {
            taskScheduleBand.value = getDefaultScheduleBandForStatus(taskStatus.value);
        }

        applyScheduleBandConfig(preserveCurrentValue);
    }

    function displayStatusName(task) {
        if (task.status_code === "done") {
            return "Đã hoàn thành";
        }

        if (task.status_code === "delayed") {
            return "Chậm tiến độ";
        }

        return "Đang triển khai";
    }

    function getFilteredTasks() {
        const selectedMonth = monthFilter.value;
        const selectedAssigner = assignerFilter.value;
        const selectedUnit = unitFilter.value;

        return state.tasks.filter((task) => {
            const unit = state.config.orgUnits.find((item) => item.code === task.unit_code);
            if (unit?.disabled) {
                return false;
            }

            if (selectedMonth && getTaskMonthValue(task) !== selectedMonth) {
                return false;
            }

            if (selectedAssigner !== "ALL" && task.assigner_code !== selectedAssigner) {
                return false;
            }

            if (selectedUnit !== "ALL" && task.unit_code !== selectedUnit) {
                return false;
            }

            return true;
        });
    }

    function getCountdownTemplate(task) {
        if (task.status_code === "done" || task.status_code === "delayed") {
            return "✓ Đã hoàn thành";
        }

        if (!task.due_date) {
            return "-";
        }

        const deadline = new Date(task.due_date);
        deadline.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((deadline - todayValue()) / (1000 * 60 * 60 * 24));

        if (diffDays > 3) {
            return `⏳ Còn ${diffDays} ngày`;
        }

        if (diffDays >= 0) {
            return `⚠️ GẤP! Còn ${diffDays} ngày`;
        }

        return `🚨 QUÁ HẠN ${Math.abs(diffDays)} ngày`;
    }

    function getStatusClass(task) {
        if (task.status_code === "done") {
            return "status-done";
        }

        if (task.status_code === "delayed") {
            return "status-delayed";
        }

        if (task.is_overdue) {
            return "status-overdue";
        }

        return "status-ontrack";
    }

    function getFirstActiveAssignerCode() {
        return state.config.assigners.find((item) => !item.disabled)?.code || state.config.assigners[0]?.code || "";
    }

    function formatAssignerLabel(assigner) {
        return assigner.disabled ? `${assigner.name} (đã tắt)` : assigner.name;
    }

    function renderTaskAssignerOptions(selectedCode = "") {
        taskAssigner.innerHTML = state.config.assigners
            .map((item) => {
                const isSelected = item.code === selectedCode;
                const isDisabled = item.disabled && !isSelected;
                return `<option value="${item.code}"${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}>${formatAssignerLabel(item)}</option>`;
            })
            .join("");
    }

    function getFirstActiveUnitCode() {
        return state.config.orgUnits.find((item) => !item.disabled)?.code || state.config.orgUnits[0]?.code || "";
    }

    function formatUnitLabel(unit) {
        return unit.disabled ? `${unit.name} (đã tắt)` : unit.name;
    }

    function renderTaskUnitOptions(selectedCode = "") {
        taskUnit.innerHTML = state.config.orgUnits
            .map((item) => {
                const isSelected = item.code === selectedCode;
                const isDisabled = item.disabled && !isSelected;
                return `<option value="${item.code}"${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}>${formatUnitLabel(item)}</option>`;
            })
            .join("");
    }

    function suggestProgressPercent(statusCode, existingTask) {
        if (statusCode === "done" || statusCode === "delayed") {
            return 100;
        }

        if (existingTask && Number.isFinite(existingTask.progress_percent)) {
            return existingTask.progress_percent;
        }

        return 50;
    }

    function resetForm() {
        editTaskId.value = "";
        renderTaskAssignerOptions(getFirstActiveAssignerCode());
        taskName.value = "";
        renderTaskUnitOptions(getFirstActiveUnitCode());
        taskDeadline.value = "";
        taskResult.value = "";
        taskOwner.value = "";
        taskAuthority.value = "";
        taskStatus.value = "in_progress";
        taskProgressUpdate.value = "";
        taskNotes.value = "";
        renderQualityBandOptions("standard");
        renderScheduleBandOptions("on_time", "in_progress");
        resetQualityFields();
        resetScheduleFields();
        formTitle.textContent = "2. Giao việc mới & thiết lập tiêu chí chỉ đạo";
        formActions.innerHTML = `<button class="btn btn-primary" id="saveTaskButton" type="button">💾 Cập nhật hệ thống giám sát</button>`;
        document.getElementById("saveTaskButton").addEventListener("click", saveTask);
    }

    function prepareEdit(taskId) {
        const task = state.tasks.find((item) => String(item.id) === String(taskId));
        if (!task) {
            return;
        }

        editTaskId.value = task.id;
        renderTaskAssignerOptions(task.assigner_code || "");
        taskName.value = task.title || "";
        renderTaskUnitOptions(task.unit_code || "");
        taskDeadline.value = task.due_date || "";
        taskResult.value = task.expected_result || "";
        taskOwner.value = task.owner_name || "";
        taskAuthority.value = task.authority_name || "";
        taskStatus.value = task.status_code;
        taskProgressUpdate.value = task.latest_update || "";
        taskNotes.value = task.latest_issue || "";
        renderQualityBandOptions(task.quality_band || "standard");
        taskQualityBand.value = task.quality_band || "standard";
        taskQualityScorePercent.value = denormalizeQualityScore(task.quality_score);
        renderScheduleBandOptions(task.schedule_band || getDefaultScheduleBandForStatus(task.status_code), task.status_code);
        taskScheduleBand.value = isScheduleBandAllowedForStatus(task.status_code, task.schedule_band)
            ? task.schedule_band
            : getDefaultScheduleBandForStatus(task.status_code);
        taskScheduleScorePercent.value = denormalizeScheduleScore(task.schedule_score);
        syncQualityFieldsWithStatus(true);
        syncScheduleFieldsWithStatus(true);

        formTitle.textContent = `📝 CHỈNH SỬA CÔNG VIỆC: ${task.title.toUpperCase()}`;
        formActions.innerHTML = `
            <button class="btn btn-success" id="updateTaskButton" type="button">💾 Lưu thay đổi</button>
            <button class="btn btn-secondary" id="cancelEditButton" type="button">Hủy chỉnh sửa</button>
        `;
        document.getElementById("updateTaskButton").addEventListener("click", saveTask);
        document.getElementById("cancelEditButton").addEventListener("click", resetForm);
        window.scrollTo({ top: document.querySelector(".form-container").offsetTop, behavior: "smooth" });
    }

    async function deleteTask(taskId) {
        const confirmed = window.confirm("Đồng chí có chắc chắn muốn loại bỏ hạng mục này?");
        if (!confirmed) {
            return;
        }

        try {
            await App.api(`/api/tasks/${taskId}`, { method: "DELETE" });
            App.showMessage("Đã xóa công việc.");
            await loadTasks();
        } catch (error) {
            App.showMessage(error.message, "error");
        }
    }

    function renderSummary() {
        summaryTableBody.innerHTML = "";
        const filteredTasks = getFilteredTasks();
        const activeUnits = state.config.orgUnits.filter((item) => !item.disabled);
        const summaryUnits = unitFilter.value !== "ALL"
            ? activeUnits.filter((item) => item.code === unitFilter.value)
            : activeUnits;
        const computedUnits = summaryUnits.map((unit, index) => {
            const unitTasks = filteredTasks.filter((task) => task.unit_code === unit.code);
            const assignedCount = unitTasks.length;
            const doneCount = unitTasks.filter((task) => task.status_code === "done").length;
            const delayedCount = unitTasks.filter((task) => task.status_code === "delayed").length;
            const completedCount = doneCount + delayedCount;
            const pendingCount = Math.max(assignedCount - completedCount, 0);

            return {
                order: index + 1,
                unit_code: unit.code,
                unit_name: unit.name,
                assigned_count: assignedCount,
                done_count: doneCount,
                completed_count: completedCount,
                pending_count: pendingCount,
                delayed_count: delayedCount,
                kpi_a_score: assignedCount ? (completedCount / assignedCount) : 0,
                kpi_a_percent: assignedCount ? Math.round((completedCount / assignedCount) * 100) : 0
            };
        });
        const summaryTotals = state.kpiASummary?.totals || {
            assigned_count: 0,
            done_count: 0,
            completed_count: 0,
            completed_ahead_count: 0,
            completed_on_time_count: 0,
            completed_late_count: 0,
            pending_count: 0,
            delayed_count: 0,
            kpi_a_score: 0,
            kpi_a_percent: 0
        };
        const kpiBUnitLookup = Object.fromEntries((state.kpiBSummary?.units || []).map((unit) => [unit.unit_code, unit]));
        const kpiCUnitLookup = Object.fromEntries((state.kpiCSummary?.units || []).map((unit) => [unit.unit_code, unit]));
        const summaryBTotal = state.kpiBSummary?.totals || {
            kpi_b_score: 0
        };
        const summaryCTotal = state.kpiCSummary?.totals || {
            kpi_c_score: 0
        };

        computedUnits.forEach((unit) => {
            const kpiBUnit = kpiBUnitLookup[unit.unit_code] || { kpi_b_score: 0 };
            const kpiCUnit = kpiCUnitLookup[unit.unit_code] || { kpi_c_score: 0 };
            const finalKpi = calculateFinalKpiScore(unit.kpi_a_score, kpiBUnit.kpi_b_score, kpiCUnit.kpi_c_score);
            summaryTableBody.innerHTML += `
                <tr>
                    <td class="text-center">${unit.order}</td>
                    <td class="fw-bold">${App.escapeHtml(unit.unit_name)}</td>
                    <td class="text-center fw-bold stat-total">${unit.assigned_count}</td>
                    <td class="text-center fw-bold stat-done">${unit.done_count}</td>
                    <td class="text-center fw-bold stat-pending">${unit.pending_count}</td>
                    <td class="text-center fw-bold stat-delayed">${unit.delayed_count}</td>
                    <td class="text-center fw-bold highlight-cell">${unit.kpi_a_percent}%</td>
                    <td class="text-center fw-bold highlight-cell">${formatKpiAScore(unit.kpi_a_score)}</td>
                    <td class="text-center fw-bold highlight-cell">${formatKpiAScore(kpiBUnit.kpi_b_score)}</td>
                    <td class="text-center fw-bold highlight-cell">${formatKpiAScore(kpiCUnit.kpi_c_score)}</td>
                    <td class="text-center fw-bold highlight-cell">${formatKpiAScore(finalKpi)}%</td>
                </tr>
            `;
        });

        const computedTotals = computedUnits.reduce((summary, unit) => ({
            assigned_count: summary.assigned_count + unit.assigned_count,
            done_count: summary.done_count + unit.done_count,
            completed_count: summary.completed_count + unit.completed_count,
            pending_count: summary.pending_count + unit.pending_count,
            delayed_count: summary.delayed_count + unit.delayed_count
        }), {
            assigned_count: 0,
            done_count: 0,
            completed_count: 0,
            pending_count: 0,
            delayed_count: 0
        });
        const resolvedSummaryTotals = {
            ...summaryTotals,
            ...computedTotals,
            kpi_a_score: computedTotals.assigned_count ? (computedTotals.completed_count / computedTotals.assigned_count) : 0,
            kpi_a_percent: computedTotals.assigned_count ? Math.round((computedTotals.completed_count / computedTotals.assigned_count) * 100) : 0
        };

        const finalKpiTotal = calculateFinalKpiScore(
            resolvedSummaryTotals.kpi_a_score,
            summaryBTotal.kpi_b_score,
            summaryCTotal.kpi_c_score
        );

        summaryTableBody.innerHTML += `
            <tr class="total-row">
                <td colspan="2" class="text-center">TỔNG CỘNG TOÀN PHÒNG</td>
                <td class="text-center stat-total">${resolvedSummaryTotals.assigned_count}</td>
                <td class="text-center stat-done">${resolvedSummaryTotals.done_count}</td>
                <td class="text-center stat-pending">${resolvedSummaryTotals.pending_count}</td>
                <td class="text-center stat-delayed">${resolvedSummaryTotals.delayed_count}</td>
                <td class="text-center highlight-total">${resolvedSummaryTotals.kpi_a_percent}%</td>
                <td class="text-center highlight-total">${formatKpiAScore(resolvedSummaryTotals.kpi_a_score)}</td>
                <td class="text-center highlight-total">${formatKpiAScore(summaryBTotal.kpi_b_score)}</td>
                <td class="text-center highlight-total">${formatKpiAScore(summaryCTotal.kpi_c_score)}</td>
                <td class="text-center highlight-total">${formatKpiAScore(finalKpiTotal)}%</td>
            </tr>
        `;

        totalTasks.textContent = resolvedSummaryTotals.assigned_count;
        doneTasks.textContent = resolvedSummaryTotals.done_count;
        pendingTasks.textContent = resolvedSummaryTotals.pending_count;
        delayedTasks.textContent = resolvedSummaryTotals.delayed_count;
    }

    function renderTaskTable() {
        const filteredTasks = getFilteredTasks();
        taskTableBody.innerHTML = "";

        filteredTasks.forEach((task, index) => {
            taskTableBody.innerHTML += `
                <tr>
                    <td class="text-center"><b>${String(index + 1).padStart(2, "0")}</b></td>
                    <td class="assigner-cell"><b>${App.escapeHtml(task.assigner_name || "-")}</b></td>
                    <td><b>${App.escapeHtml(task.title)}</b></td>
                    <td><span class="unit-tag">${App.escapeHtml(task.unit_name)}</span></td>
                    <td>
                        Hạn: <b>${formatDate(task.due_date)}</b><br>
                        <span class="status-badge ${getStatusClass(task)}">${displayStatusName(task)}</span><br>
                        <small>${getCountdownTemplate(task)}</small>
                    </td>
                    <td>${App.escapeHtml(task.expected_result || "-")}</td>
                    <td><strong>${App.escapeHtml(task.owner_name || "-")}</strong></td>
                    <td><small>${App.escapeHtml(task.authority_name || "-")}</small></td>
                    <td class="progress-cell">${App.escapeHtml(task.latest_update || "-")}</td>
                    <td class="note-cell">${App.escapeHtml(task.latest_issue || "-")}</td>
                    <td class="no-export">
                        <div class="action-btns">
                            <button class="btn btn-warning" type="button" data-action="edit" data-id="${task.id}">✏️ Sửa</button>
                            <button class="btn btn-danger" type="button" data-action="delete" data-id="${task.id}">Xóa</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        if (!filteredTasks.length) {
            taskTableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center empty-table">Chưa có công việc phù hợp với bộ lọc hiện tại.</td>
                </tr>
            `;
        }
    }

    function renderAll() {
        renderSummary();
        renderTaskTable();
    }

    function buildKpiASummaryUrl() {
        const params = new URLSearchParams();
        params.set("month", monthFilter.value || getCurrentMonthValue());

        if (assignerFilter.value && assignerFilter.value !== "ALL") {
            params.set("assigner_code", assignerFilter.value);
        }

        if (unitFilter.value && unitFilter.value !== "ALL") {
            params.set("unit_code", unitFilter.value);
        }

        return `/api/kpi/a/summary?${params.toString()}`;
    }

    function buildKpiBSummaryUrl() {
        const params = new URLSearchParams();
        params.set("month", monthFilter.value || getCurrentMonthValue());

        if (assignerFilter.value && assignerFilter.value !== "ALL") {
            params.set("assigner_code", assignerFilter.value);
        }

        if (unitFilter.value && unitFilter.value !== "ALL") {
            params.set("unit_code", unitFilter.value);
        }

        return `/api/kpi/b/summary?${params.toString()}`;
    }

    function buildKpiCSummaryUrl() {
        const params = new URLSearchParams();
        params.set("month", monthFilter.value || getCurrentMonthValue());

        if (assignerFilter.value && assignerFilter.value !== "ALL") {
            params.set("assigner_code", assignerFilter.value);
        }

        if (unitFilter.value && unitFilter.value !== "ALL") {
            params.set("unit_code", unitFilter.value);
        }

        return `/api/kpi/c/summary?${params.toString()}`;
    }

    async function loadTasks() {
        const [tasks, kpiASummary, kpiBSummary, kpiCSummary] = await Promise.all([
            App.api("/api/tasks"),
            App.api(buildKpiASummaryUrl()),
            App.api(buildKpiBSummaryUrl()),
            App.api(buildKpiCSummaryUrl())
        ]);

        state.tasks = tasks;
        state.kpiASummary = kpiASummary;
        state.kpiBSummary = kpiBSummary;
        state.kpiCSummary = kpiCSummary;
        renderAll();
    }

    function analyzeDocument() {
        const rawText = rawDocument.value.trim();
        if (!rawText) {
            App.showMessage("Vui lòng dán nội dung văn bản chỉ đạo vào ô trống trước!", "error");
            return;
        }

        const textLower = rawText.toLowerCase();
        const firstSentence = rawText.split(".")[0].trim();
        let assignerDraftCode = getFirstActiveAssignerCode();
        let unitDraftCode = state.config.orgUnits[0]?.code || "";

        if (textLower.includes("giám đốc")) {
            assignerDraftCode = state.config.assigners.find((item) => !item.disabled && item.name.toLowerCase().includes("giám đốc công an tỉnh"))?.code || assignerDraftCode;
        } else if (textLower.includes("phó giám đốc")) {
            assignerDraftCode = state.config.assigners.find((item) => !item.disabled && item.name.toLowerCase().includes("phó giám đốc"))?.code || assignerDraftCode;
        } else if (textLower.includes("trưởng phòng")) {
            assignerDraftCode = state.config.assigners.find((item) => !item.disabled && item.name.toLowerCase().includes("trưởng phòng"))?.code || assignerDraftCode;
        }

        const unitMatchers = [
            { keywords: ["trung tâm", "udkhcn", "khoa học", "công nghệ"], finder: "trung tâm" },
            { keywords: ["tài chính", "kinh phí", "ngân sách"], finder: "tài chính" },
            { keywords: ["xe máy", "phương tiện", "đội xe"], finder: "đội xe" },
            { keywords: ["xây dựng", "doanh trại"], finder: "xây dựng" },
            { keywords: ["tài sản", "trang cấp"], finder: "tài sản" },
            { keywords: ["hành chính", "quản trị"], finder: "hành chính" },
            { keywords: ["nhà khách"], finder: "nhà khách" },
            { keywords: ["núi nhạn"], finder: "núi nhạn" }
        ];

        for (const matcher of unitMatchers) {
            if (matcher.keywords.some((keyword) => textLower.includes(keyword))) {
                unitDraftCode = state.config.orgUnits.find((item) => item.name.toLowerCase().includes(matcher.finder))?.code || unitDraftCode;
                break;
            }
        }

        taskAssigner.value = assignerDraftCode;
        taskName.value = firstSentence ? `Triển khai: ${firstSentence}` : "";
        taskUnit.value = unitDraftCode;
        taskResult.value = "Báo cáo tiến độ gửi về Phòng Hậu cần";
        taskAuthority.value = "Lãnh đạo Phòng phê duyệt";

        const dateMatch = rawText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
            taskDeadline.value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        }

        App.showMessage(`Đã đề xuất cấp giao việc: ${taskAssigner.selectedOptions[0]?.textContent || ""} | đơn vị: ${taskUnit.selectedOptions[0]?.textContent || ""}`);
        window.scrollTo({ top: document.querySelector(".form-container").offsetTop, behavior: "smooth" });
    }

    async function saveTask() {
        const assigner = state.config.assigners.find((item) => item.code === taskAssigner.value) || null;
        if (!assigner) {
            App.showMessage("Cấp giao việc chưa khớp danh mục cấu hình hiện tại.", "error");
            return;
        }

        const currentTask = state.tasks.find((item) => String(item.id) === editTaskId.value) || null;
        if (assigner.disabled && (!currentTask || currentTask.assigner_code !== assigner.code)) {
            App.showMessage("Lãnh đạo giao việc này đã ngừng sử dụng.", "error");
            return;
        }

        if (!taskName.value.trim() || !taskDeadline.value) {
            App.showMessage("Vui lòng nhập đủ nội dung công việc và hạn cuối hoàn thành.", "error");
            return;
        }

        let qualityBand = null;
        let qualityScore = null;
        let scheduleBand = null;
        let scheduleScore = null;
        if (taskStatus.value === "done" || taskStatus.value === "delayed") {
            const qualityBandConfig = getQualityBandConfig(taskQualityBand.value);
            const qualityPercent = Number(taskQualityScorePercent.value);
            const scheduleBandConfig = getScheduleBandConfig(taskScheduleBand.value);
            const schedulePercent = Number(taskScheduleScorePercent.value);

            if (!qualityBandConfig) {
                App.showMessage("Vui lòng chọn mức chất lượng.", "error");
                return;
            }

            if (!Number.isFinite(qualityPercent)
                || qualityPercent < qualityBandConfig.min_percent
                || qualityPercent > qualityBandConfig.max_percent) {
                App.showMessage(`Điểm chất lượng phải nằm trong khoảng ${qualityBandConfig.min_percent}-${qualityBandConfig.max_percent}%.`, "error");
                return;
            }

            if (!scheduleBandConfig) {
                App.showMessage("Vui lòng chọn mức KPI-C.", "error");
                return;
            }

            if (!Number.isFinite(schedulePercent)
                || schedulePercent < scheduleBandConfig.min_percent
                || schedulePercent > scheduleBandConfig.max_percent) {
                App.showMessage(`Điểm KPI-C phải nằm trong khoảng ${scheduleBandConfig.min_percent}-${scheduleBandConfig.max_percent}%.`, "error");
                return;
            }

            qualityBand = qualityBandConfig.code;
            qualityScore = normalizeQualityPercent(qualityPercent);
            scheduleBand = scheduleBandConfig.code;
            scheduleScore = normalizeSchedulePercent(schedulePercent);
        } else {
            qualityBand = "standard";
            qualityScore = 1;
            scheduleBand = "on_time";
            scheduleScore = 1;
        }

        const payload = {
            title: taskName.value.trim(),
            assigner_code: assigner.code,
            unit_code: taskUnit.value,
            owner_name: taskOwner.value.trim(),
            authority_name: taskAuthority.value.trim(),
            priority_code: currentTask?.priority_code || "normal",
            status_code: taskStatus.value,
            progress_percent: suggestProgressPercent(taskStatus.value, currentTask),
            due_date: taskDeadline.value,
            expected_result: taskResult.value.trim(),
            latest_update: taskProgressUpdate.value.trim(),
            latest_issue: taskNotes.value.trim(),
            quality_band: qualityBand,
            quality_score: qualityScore,
            schedule_band: scheduleBand,
            schedule_score: scheduleScore
        };

        try {
            const response = await App.api(editTaskId.value ? `/api/tasks/${editTaskId.value}` : "/api/tasks", {
                method: editTaskId.value ? "PUT" : "POST",
                body: JSON.stringify(payload)
            });

            App.showMessage(response.message || "Đã cập nhật hệ thống giám sát.");
            resetForm();
            await loadTasks();
        } catch (error) {
            App.showMessage(error.message, "error");
        }
    }

    function exportToExcelAll() {
        const selectedMonthLabel = getMonthFilterLabel(monthFilter.value || getCurrentMonthValue());
        const selectedAssigner = assignerFilter.value;
        const selectedUnit = unitFilter.value;
        const filteredTasks = getFilteredTasks();
        const selectedAssignerLabel = selectedAssigner === "ALL"
            ? "Tất cả lãnh đạo giao việc"
            : state.config.assigners.find((item) => item.code === selectedAssigner)?.name || selectedAssigner;
        const selectedUnitLabel = selectedUnit === "ALL"
            ? "Tất cả đơn vị trực thuộc"
            : state.config.orgUnits.find((item) => item.code === selectedUnit)?.name || selectedUnit;
        const now = new Date();
        const currentTimeStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

        const exportKpiBLookup = Object.fromEntries((state.kpiBSummary?.units || []).map((unit) => [unit.unit_code, unit]));
        const exportKpiCLookup = Object.fromEntries((state.kpiCSummary?.units || []).map((unit) => [unit.unit_code, unit]));
        let summaryRows = "";
        let grandTotal = 0;
        let grandDone = 0;
        let grandCompleted = 0;
        let grandPending = 0;
        let grandDelayed = 0;

        state.config.orgUnits.filter((unit) => !unit.disabled).forEach((unit, index) => {
            const unitTasks = filteredTasks.filter((task) => task.unit_code === unit.code);
            const total = unitTasks.length;
            const done = unitTasks.filter((task) => task.status_code === "done").length;
            const delayed = unitTasks.filter((task) => task.status_code === "delayed").length;
            const completed = done + delayed;
            const pending = total - completed;
            const kpiAScore = total ? (completed / total) : 0;
            const kpiBScore = exportKpiBLookup[unit.code]?.kpi_b_score || 0;
            const kpiCScore = exportKpiCLookup[unit.code]?.kpi_c_score || 0;
            const finalKpiScore = calculateFinalKpiScore(kpiAScore, kpiBScore, kpiCScore);
            const percent = total ? Math.round((completed / total) * 100) : 0;
            grandTotal += total;
            grandDone += done;
            grandCompleted += completed;
            grandPending += pending;
            grandDelayed += delayed;

            summaryRows += `
                <tr class="data-row">
                    <td class="text-center">${index + 1}</td>
                    <td class="text-left font-bold">${unit.name}</td>
                    <td class="text-center font-bold">${total}</td>
                    <td class="text-center font-bold text-success">${done}</td>
                    <td class="text-center font-bold text-warning">${pending}</td>
                    <td class="text-center font-bold text-danger">${delayed}</td>
                    <td class="text-center font-bold highlight-cell">${percent}%</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(kpiAScore)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(kpiBScore)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(kpiCScore)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(finalKpiScore)}%</td>
                </tr>
            `;
        });

        const grandKpiAScore = grandTotal ? (grandCompleted / grandTotal) : 0;
        const grandKpiBScore = state.kpiBSummary?.totals?.kpi_b_score || 0;
        const grandKpiCScore = state.kpiCSummary?.totals?.kpi_c_score || 0;
        const grandFinalKpiScore = calculateFinalKpiScore(grandKpiAScore, grandKpiBScore, grandKpiCScore);
        const grandPercent = grandTotal ? Math.round((grandCompleted / grandTotal) * 100) : 0;
        const summaryTotalRow = `
            <tr class="total-row">
                <td colspan="2" class="text-center font-bold">TỔNG CỘNG TOÀN PHÒNG</td>
                <td class="text-center font-bold">${grandTotal}</td>
                <td class="text-center font-bold text-success">${grandDone}</td>
                <td class="text-center font-bold text-warning">${grandPending}</td>
                <td class="text-center font-bold text-danger">${grandDelayed}</td>
                <td class="text-center font-bold highlight-total">${grandPercent}%</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(grandKpiAScore)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(grandKpiBScore)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(grandKpiCScore)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(grandFinalKpiScore)}%</td>
            </tr>
        `;

        let detailRows = "";
        let count = 0;
        filteredTasks.forEach((task) => {
            count += 1;
            const currentStatus = displayStatusName(task);
            const statusColorClass = task.status_code === "done"
                ? "text-success"
                : task.status_code === "delayed"
                    ? "text-danger"
                    : task.is_overdue
                        ? "text-danger"
                        : "text-warning";

            detailRows += `
                <tr class="data-row">
                    <td class="text-center">${String(count).padStart(2, "0")}</td>
                    <td class="text-left font-bold text-darkorange">${task.assigner_name || "-"}</td>
                    <td class="text-left font-bold">${task.title}</td>
                    <td class="text-center"><span class="badge-unit">${task.unit_name}</span></td>
                    <td class="text-center font-bold">Hạn: ${formatDate(task.due_date)}<br/><span class="${statusColorClass}">${currentStatus}</span><br/><small style="color:#718096;">${getCountdownTemplate(task)}</small></td>
                    <td class="text-left">${task.expected_result || "-"}</td>
                    <td class="text-left font-bold">${task.owner_name || "-"}</td>
                    <td class="text-left"><small>${task.authority_name || "-"}</small></td>
                    <td class="text-left font-bold text-link">${task.latest_update || "-"}</td>
                    <td class="text-left text-italic">${task.latest_issue || "-"}</td>
                </tr>
            `;
        });

        const excelTemplate = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8"/>
                <style>
                    body { font-family: "Segoe UI", "Arial", sans-serif; color: #2d3748; }
                    table { border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; width: 100%; }
                    th, td { border: 1px solid #a0aec0 !important; padding: 8px 10px; vertical-align: middle; mso-number-format:"\\@"; white-space: normal; word-wrap: break-word; }
                    .main-title { font-size: 18pt; font-weight: bold; color: #1a365d; text-align: center; font-family: "Segoe UI", Arial; text-transform: uppercase; }
                    .sub-title { font-size: 11pt; font-style: italic; color: #4a5568; text-align: center; }
                    .section-heading { font-size: 13pt; font-weight: bold; color: #1a365d; font-family: "Segoe UI", Arial; margin-top: 20px; margin-bottom: 8px; }
                    th { background-color: #1a365d !important; color: #ffffff !important; font-size: 10.5pt; font-weight: bold; text-align: center; text-transform: uppercase; height: 32px; }
                    .data-row { height: 26px; font-size: 11pt; }
                    .total-row { background-color: #cbd5e0 !important; font-size: 11pt; font-weight: bold; height: 30px; }
                    .text-center { text-align: center; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: bold; }
                    .text-italic { font-style: italic; color: #4a5568; }
                    .text-success { color: #22543d !important; font-weight: bold; }
                    .text-warning { color: #b7791f !important; font-weight: bold; }
                    .text-danger { color: #9b2c2c !important; font-weight: bold; }
                    .text-darkorange { color: #c05621 !important; }
                    .text-link { color: #2b6cb0 !important; }
                    .highlight-cell { background-color: #edf2f7 !important; color: #1a365d !important; }
                    .highlight-total { background-color: #a0aec0 !important; color: #1a365d !important; }
                    .badge-unit { background-color: #ebf8ff !important; color: #1a365d !important; padding: 2px 4px; border-radius: 4px; font-weight: bold; }
                    .completion-cell { line-height: 1.35; }
                    .completion-total { font-size: 11pt; font-weight: bold; }
                    .completion-breakdown { font-size: 9pt; font-weight: 600; }
                </style>
            </head>
            <body>
                <table>
                    <tr><td colspan="12" style="border:none !important;" class="main-title">BÁO CÁO GIÁM SÁT TIẾN ĐỘ CÔNG VIỆC HẬU CẦN TIÊU CHÍ "7 RÕ"</td></tr>
                    <tr><td colspan="12" style="border:none !important;" class="sub-title">Phạm vi dữ liệu: ${selectedMonthLabel} | ${selectedAssignerLabel} | ${selectedUnitLabel} | Ngày lập báo cáo trực tuyến: ${currentTimeStr}</td></tr>
                </table>
                <div class="section-heading">I. BẢNG TỔNG HỢP TIẾN ĐỘ & HIỆU SUẤT CÁC ĐỘI NGHIỆP VỤ</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 45px;">STT</th>
                            <th style="width: 250px;">Đơn vị trực thuộc</th>
                            <th style="width: 120px;">Tổng số nhiệm vụ</th>
                            <th style="width: 180px;">Đã hoàn thành</th>
                            <th style="width: 120px;">Đang triển khai</th>
                            <th style="width: 120px;">Chậm tiến độ</th>
                            <th style="width: 150px;">Tỷ lệ hoàn thành</th>
                            <th style="width: 110px;">KPI-A</th>
                            <th style="width: 110px;">KPI-B</th>
                            <th style="width: 110px;">KPI-C</th>
                            <th style="width: 110px;">KPI</th>
                        </tr>
                    </thead>
                    <tbody>${summaryRows}${summaryTotalRow}</tbody>
                </table>
                <br/>
                <div style="font-size:10pt; color:#4a5568; margin-bottom:10px;">
                    <strong>Lưu ý:</strong> "Chậm tiến độ" là công việc đã hoàn thành nhưng hoàn thành sau hạn. Công việc chưa hoàn thành nhưng đã quá hạn vẫn thuộc trạng thái "Đang triển khai" và được cảnh báo bằng bộ đếm ngược.
                </div>
                <div class="section-heading">II. BẢNG CHI TIẾT THEO DÕI TIẾN ĐỘ CÔNG VIỆC CỤ THỂ KHỐI HẬU CẦN</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 45px;">STT</th>
                            <th style="width: 140px;">1. LÃNH ĐẠO GIAO</th>
                            <th style="width: 260px;">2. RÕ VIỆC (Nội dung)</th>
                            <th style="width: 140px;">3. RÕ NGƯỜI (Đơn vị)</th>
                            <th style="width: 160px;">4. TIẾN ĐỘ & TRẠNG THÁI</th>
                            <th style="width: 220px;">5. RÕ KẾT QUẢ ĐẦU RA</th>
                            <th style="width: 140px;">6. RÕ TRÁCH NHIỆM</th>
                            <th style="width: 130px;">7. RÕ THẨM QUYỀN</th>
                            <th style="width: 240px;">CẬP NHẬT KẾT QUẢ THỰC TẾ</th>
                            <th style="width: 180px;">GHI CHÚ / KHÓ KHĂN</th>
                        </tr>
                    </thead>
                    <tbody>${detailRows}</tbody>
                </table>
            </body>
            </html>
        `;

        const blobData = new Blob(["\uFEFF" + excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8" });
        const url = window.URL.createObjectURL(blobData);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Bao_Cao_Hau_Can_Phan_Tich_7Ro_${selectedUnitLabel.replace(/\s+/g, "_")}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    async function bootstrap() {
        try {
            state.config = await App.getConfig();
            monthFilter.value = getCurrentMonthValue();

            assignerFilter.innerHTML = [
                '<option value="ALL">-- Xem tất cả lãnh đạo giao việc --</option>',
                ...state.config.assigners
                    .filter((item) => !item.disabled)
                    .map((item) => `<option value="${item.code}">${item.name}</option>`)
            ].join("");

            const activeOrgUnits = state.config.orgUnits.filter((item) => !item.disabled);
            unitFilter.innerHTML = [
                `<option value="ALL">-- Xem tất cả đơn vị trực thuộc (${activeOrgUnits.length} đơn vị) --</option>`,
                ...activeOrgUnits.map((item) => `<option value="${item.code}">${item.name}</option>`)
            ].join("");

            renderTaskAssignerOptions(getFirstActiveAssignerCode());
            renderTaskUnitOptions(getFirstActiveUnitCode());
            renderQualityBandOptions("standard");
            renderScheduleBandOptions("on_time", "in_progress");
            applyKpiFieldLabels();

            analyzeDocumentButton.addEventListener("click", analyzeDocument);
            exportExcelButton.addEventListener("click", exportToExcelAll);
            monthFilter.addEventListener("change", () => {
                loadTasks().catch((error) => App.showMessage(error.message, "error"));
            });
            assignerFilter.addEventListener("change", () => {
                loadTasks().catch((error) => App.showMessage(error.message, "error"));
            });
            unitFilter.addEventListener("change", () => {
                loadTasks().catch((error) => App.showMessage(error.message, "error"));
            });
            taskStatus.addEventListener("change", () => {
                syncQualityFieldsWithStatus(false);
                syncScheduleFieldsWithStatus(false);
            });
            taskQualityBand.addEventListener("change", () => {
                applyQualityBandConfig(false);
            });
            taskScheduleBand.addEventListener("change", () => {
                applyScheduleBandConfig(false);
            });
            taskTableBody.addEventListener("click", async (event) => {
                const button = event.target.closest("[data-action]");
                if (!button) {
                    return;
                }

                if (button.dataset.action === "edit") {
                    prepareEdit(button.dataset.id);
                    return;
                }

                if (button.dataset.action === "delete") {
                    await deleteTask(button.dataset.id);
                }
            });

            resetForm();
            await loadTasks();
        } catch (error) {
            App.showMessage(error.message, "error");
            summaryTableBody.innerHTML = `<tr><td colspan="11" class="text-center empty-table">Không thể tải dữ liệu dashboard.</td></tr>`;
            taskTableBody.innerHTML = `<tr><td colspan="11" class="text-center empty-table">Không thể tải danh sách công việc.</td></tr>`;
        }
    }

    await bootstrap();
})();
