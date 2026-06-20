"use strict";

const kpiCriterionA = require("./criterion-a");

const SCHEDULE_BANDS = [
    {
        code: "ahead",
        label: "Vượt tiến độ",
        min_percent: 101,
        max_percent: 120,
        default_percent: 120,
        locked: false
    },
    {
        code: "on_time",
        label: "Đúng hạn",
        min_percent: 100,
        max_percent: 100,
        default_percent: 100,
        locked: true
    },
    {
        code: "remind_1",
        label: "Bị nhắc nhở 1 lần",
        min_percent: 51,
        max_percent: 75,
        default_percent: 75,
        locked: false
    },
    {
        code: "remind_2",
        label: "Bị nhắc nhở 2 lần",
        min_percent: 26,
        max_percent: 50,
        default_percent: 50,
        locked: false
    },
    {
        code: "remind_3",
        label: "Bị nhắc nhở 3 lần",
        min_percent: 1,
        max_percent: 25,
        default_percent: 25,
        locked: false
    },
    {
        code: "remind_4_plus_or_no_report",
        label: "Bị nhắc nhở từ 04 lần/Trễ hạn không báo cáo",
        min_percent: 0,
        max_percent: 0,
        default_percent: 0,
        locked: true
    }
];

const SCHEDULE_BAND_LOOKUP = Object.fromEntries(SCHEDULE_BANDS.map((band) => [band.code, band]));

function clampScheduleScore(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.max(0, Math.min(1.2, numericValue));
}

function parseScheduleScore(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return numericValue;
}

function normalizeSchedulePercent(percent) {
    const numericPercent = Number(percent);
    if (!Number.isFinite(numericPercent)) {
        return 0;
    }

    return clampScheduleScore(numericPercent / 100);
}

function denormalizeScheduleScore(score) {
    return Math.round(clampScheduleScore(score) * 100);
}

function getScheduleBandOptions() {
    return SCHEDULE_BANDS.map((band) => ({ ...band }));
}

function getScheduleBandConfig(code) {
    return SCHEDULE_BAND_LOOKUP[String(code || "").trim()] || null;
}

function validateScheduleFields(taskPayload) {
    const statusCode = String(taskPayload?.status_code || "").trim();
    const scheduleBand = String(taskPayload?.schedule_band || "").trim();
    const rawScheduleScore = taskPayload?.schedule_score;
    const requiresScheduleInput = statusCode === "done" || statusCode === "delayed";

    if (!requiresScheduleInput) {
        if (!scheduleBand && (rawScheduleScore === null || rawScheduleScore === undefined || rawScheduleScore === "")) {
            return null;
        }

        if (scheduleBand !== "on_time") {
            return "Cong viec dang trien khai dung tien do phai mac dinh muc tien do Dung han.";
        }

        const score = parseScheduleScore(rawScheduleScore);
        if (score === null || denormalizeScheduleScore(score) !== 100) {
            return "Cong viec dang trien khai dung tien do phai mac dinh diem KPI C la 100%.";
        }

        return null;
    }

    if (!scheduleBand && (rawScheduleScore === null || rawScheduleScore === undefined || rawScheduleScore === "")) {
        return "Vui long nhap thong tin KPI C cho cong viec da hoan thanh hoac cham tien do.";
    }

    const scheduleBandConfig = getScheduleBandConfig(scheduleBand);
    if (!scheduleBandConfig) {
        return "Muc KPI C khong hop le.";
    }

    if (statusCode === "done" && scheduleBand !== "ahead" && scheduleBand !== "on_time") {
        return "Cong viec da hoan thanh chi duoc chon muc KPI C Vuot tien do hoac Dung han.";
    }

    if (statusCode === "delayed" && (scheduleBand === "ahead" || scheduleBand === "on_time")) {
        return "Cong viec cham tien do phai chon muc KPI C phan anh hoan thanh muon.";
    }

    const score = parseScheduleScore(rawScheduleScore);
    if (score === null || score < 0 || score > 1.2) {
        return "Diem KPI C phai nam trong khoang tu 0 den 1.2.";
    }

    const scorePercent = denormalizeScheduleScore(score);
    if (scorePercent < scheduleBandConfig.min_percent || scorePercent > scheduleBandConfig.max_percent) {
        return `Diem KPI C phai nam trong khoang ${scheduleBandConfig.min_percent}-${scheduleBandConfig.max_percent}%.`;
    }

    return null;
}

function getTaskKpiCScore(task) {
    if (task?.status_code !== "done" && task?.status_code !== "delayed") {
        return null;
    }

    return clampScheduleScore(task?.schedule_score);
}

function buildKpiCSummary(options = {}) {
    const {
        tasks = [],
        orgUnits = [],
        month = "",
        assignerCode = "",
        unitCode = "",
        kpiStartDay = 1
    } = options;

    const activeUnits = (Array.isArray(orgUnits) ? orgUnits : []).filter((orgUnit) => !orgUnit.disabled);
    const visibleUnits = unitCode
        ? activeUnits.filter((orgUnit) => orgUnit.code === unitCode)
        : activeUnits;

    const units = visibleUnits.map((orgUnit, index) => {
        const unitTasks = kpiCriterionA.filterTasksByKpiAMonth(tasks, {
            month,
            assignerCode,
            unitCode: orgUnit.code,
            kpiStartDay
        });

        const scoredTasks = unitTasks.filter((task) => task.status_code === "done" || task.status_code === "delayed");
        const totalScore = scoredTasks.reduce((sum, task) => sum + clampScheduleScore(task?.schedule_score), 0);
        const kpiCScore = scoredTasks.length ? (totalScore / scoredTasks.length) : 0;

        return {
            order: index + 1,
            unit_code: orgUnit.code,
            unit_name: orgUnit.name,
            completed_count: scoredTasks.length,
            total_schedule_score: totalScore,
            kpi_c_score: kpiCScore
        };
    });

    const totals = units.reduce((aggregate, unit) => ({
        completed_count: aggregate.completed_count + unit.completed_count,
        total_schedule_score: aggregate.total_schedule_score + unit.total_schedule_score
    }), {
        completed_count: 0,
        total_schedule_score: 0
    });

    return {
        month,
        completed_count: totals.completed_count,
        units,
        totals: {
            ...totals,
            kpi_c_score: totals.completed_count ? (totals.total_schedule_score / totals.completed_count) : 0
        }
    };
}

module.exports = {
    getScheduleBandOptions,
    getScheduleBandConfig,
    normalizeSchedulePercent,
    denormalizeScheduleScore,
    validateScheduleFields,
    getTaskKpiCScore,
    buildKpiCSummary
};
