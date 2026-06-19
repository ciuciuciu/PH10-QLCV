"use strict";

const kpiCriterionA = require("./criterion-a");

const QUALITY_BANDS = [
    {
        code: "bonus_innovation",
        label: "Vượt yêu cầu, sáng tạo",
        min_percent: 101,
        max_percent: 120,
        default_percent: 120,
        locked: false
    },
    {
        code: "standard",
        label: "Đảm bảo chất lượng",
        min_percent: 100,
        max_percent: 100,
        default_percent: 100,
        locked: true
    },
    {
        code: "revise_1",
        label: "Sửa 01 lần",
        min_percent: 51,
        max_percent: 75,
        default_percent: 75,
        locked: false
    },
    {
        code: "revise_2_4",
        label: "Sửa 02-04 lần",
        min_percent: 26,
        max_percent: 50,
        default_percent: 50,
        locked: false
    },
    {
        code: "revise_5_6",
        label: "Sửa 05-06 lần",
        min_percent: 1,
        max_percent: 25,
        default_percent: 25,
        locked: false
    },
    {
        code: "revise_7_plus",
        label: "Sửa từ 07 lần trở lên",
        min_percent: 0,
        max_percent: 0,
        default_percent: 0,
        locked: true
    }
];

const QUALITY_BAND_LOOKUP = Object.fromEntries(QUALITY_BANDS.map((band) => [band.code, band]));

function clampQualityScore(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.max(0, Math.min(1.2, numericValue));
}

function parseQualityScore(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return numericValue;
}

function normalizeQualityPercent(percent) {
    const numericPercent = Number(percent);
    if (!Number.isFinite(numericPercent)) {
        return 0;
    }

    return clampQualityScore(numericPercent / 100);
}

function denormalizeQualityScore(score) {
    return Math.round(clampQualityScore(score) * 100);
}

function getQualityBandOptions() {
    return QUALITY_BANDS.map((band) => ({ ...band }));
}

function getQualityBandConfig(code) {
    return QUALITY_BAND_LOOKUP[String(code || "").trim()] || null;
}

function validateQualityFields(taskPayload) {
    const statusCode = String(taskPayload?.status_code || "").trim();
    const qualityBand = String(taskPayload?.quality_band || "").trim();
    const rawQualityScore = taskPayload?.quality_score;
    const requiresQualityInput = statusCode === "done" || statusCode === "delayed";

    if (!requiresQualityInput) {
        if (!qualityBand && (rawQualityScore === null || rawQualityScore === undefined || rawQualityScore === "")) {
            return null;
        }

        if (qualityBand !== "standard") {
            return "Cong viec dang trien khai dung tien do phai mac dinh muc chat luong Dam bao chat luong.";
        }

        const score = parseQualityScore(rawQualityScore);
        if (score === null || denormalizeQualityScore(score) !== 100) {
            return "Cong viec dang trien khai dung tien do phai mac dinh diem chat luong 100%.";
        }

        return null;
    }

    if (!qualityBand && (rawQualityScore === null || rawQualityScore === undefined || rawQualityScore === "")) {
        return "Vui long nhap thong tin chat luong cho cong viec da hoan thanh hoac cham tien do.";
    }

    const qualityBandConfig = getQualityBandConfig(qualityBand);
    if (!qualityBandConfig) {
        return "Muc chat luong khong hop le.";
    }

    const score = parseQualityScore(rawQualityScore);
    if (score === null || score < 0 || score > 1.2) {
        return "Diem chat luong phai nam trong khoang tu 0 den 1.2.";
    }

    const scorePercent = denormalizeQualityScore(score);
    if (scorePercent < qualityBandConfig.min_percent || scorePercent > qualityBandConfig.max_percent) {
        return `Diem chat luong phai nam trong khoang ${qualityBandConfig.min_percent}-${qualityBandConfig.max_percent}%.`;
    }

    return null;
}

function getTaskKpiBScore(task) {
    if (task?.status_code !== "done" && task?.status_code !== "delayed") {
        return null;
    }

    return clampQualityScore(task?.quality_score);
}

function buildKpiBSummary(options = {}) {
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
        const totalScore = scoredTasks.reduce((sum, task) => sum + clampQualityScore(task?.quality_score), 0);
        const kpiBScore = scoredTasks.length ? (totalScore / scoredTasks.length) : 0;

        return {
            order: index + 1,
            unit_code: orgUnit.code,
            unit_name: orgUnit.name,
            completed_count: scoredTasks.length,
            total_quality_score: totalScore,
            kpi_b_score: kpiBScore
        };
    });

    const totals = units.reduce((aggregate, unit) => ({
        completed_count: aggregate.completed_count + unit.completed_count,
        total_quality_score: aggregate.total_quality_score + unit.total_quality_score
    }), {
        completed_count: 0,
        total_quality_score: 0
    });

    return {
        month,
        completed_count: totals.completed_count,
        units,
        totals: {
            ...totals,
            kpi_b_score: totals.completed_count ? (totals.total_quality_score / totals.completed_count) : 0
        }
    };
}

module.exports = {
    getQualityBandOptions,
    getQualityBandConfig,
    normalizeQualityPercent,
    denormalizeQualityScore,
    validateQualityFields,
    getTaskKpiBScore,
    buildKpiBSummary
};
