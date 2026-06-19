"use strict";

function getCompletionTimingCode(task) {
    if (task?.status_code !== "done") {
        return "";
    }

    if (task?.schedule_band === "ahead") {
        return "ahead";
    }

    if (task?.schedule_band === "on_time") {
        return "on_time";
    }

    return "late";
}

function padNumber(value) {
    return String(value).padStart(2, "0");
}

function extractIsoDate(value) {
    const normalizedValue = String(value || "").trim();
    const matchedDate = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!matchedDate) {
        return null;
    }

    return {
        year: Number(matchedDate[1]),
        month: Number(matchedDate[2]),
        day: Number(matchedDate[3])
    };
}

function isValidMonthValue(value) {
    return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function getPreviousMonth(year, month) {
    if (month > 1) {
        return { year, month: month - 1 };
    }

    return { year: year - 1, month: 12 };
}

function getKpiMonthValueFromDate(dateValue, kpiStartDay = 1) {
    const extractedDate = extractIsoDate(dateValue);
    if (!extractedDate) {
        return "";
    }

    const safeStartDay = Math.max(1, Math.min(31, Number(kpiStartDay) || 1));
    const bucket = extractedDate.day >= safeStartDay
        ? { year: extractedDate.year, month: extractedDate.month }
        : getPreviousMonth(extractedDate.year, extractedDate.month);

    return `${bucket.year}-${padNumber(bucket.month)}`;
}

function getDueKpiMonth(task, kpiStartDay = 1) {
    return getKpiMonthValueFromDate(task?.due_date, kpiStartDay);
}

function getCompletedKpiMonth(task, kpiStartDay = 1) {
    return getKpiMonthValueFromDate(task?.completed_at, kpiStartDay);
}

function getEffectiveKpiMonth(task, kpiStartDay = 1) {
    const dueKpiMonth = getDueKpiMonth(task, kpiStartDay);
    const completedKpiMonth = getCompletedKpiMonth(task, kpiStartDay);
    return dueKpiMonth || completedKpiMonth || "";
}

function attachKpiAMetadata(task, kpiStartDay = 1) {
    return {
        ...task,
        kpi_due_month: getDueKpiMonth(task, kpiStartDay),
        kpi_completed_month: getCompletedKpiMonth(task, kpiStartDay),
        kpi_month: getEffectiveKpiMonth(task, kpiStartDay)
    };
}

function filterTasksByKpiAMonth(tasks, options = {}) {
    const {
        month = "",
        assignerCode = "",
        unitCode = "",
        kpiStartDay = 1
    } = options;

    const normalizedMonth = isValidMonthValue(month) ? month : "";

    return (Array.isArray(tasks) ? tasks : []).filter((task) => {
        const effectiveTask = task?.kpi_month ? task : attachKpiAMetadata(task, kpiStartDay);

        if (normalizedMonth && effectiveTask.kpi_month !== normalizedMonth) {
            return false;
        }

        if (assignerCode && effectiveTask.assigner_code !== assignerCode) {
            return false;
        }

        if (unitCode && effectiveTask.unit_code !== unitCode) {
            return false;
        }

        return true;
    });
}

function getAssignedTaskCountByMonth(tasks, options = {}) {
    return filterTasksByKpiAMonth(tasks, options).length;
}

function getCompletedTaskCountByMonth(tasks, options = {}) {
    return filterTasksByKpiAMonth(tasks, options).filter((task) => task.status_code === "done").length;
}

function buildKpiASummary(options = {}) {
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
        const unitTasks = filterTasksByKpiAMonth(tasks, {
            month,
            assignerCode,
            unitCode: orgUnit.code,
            kpiStartDay
        });

        const assignedCount = unitTasks.length;
        const completedCount = unitTasks.filter((task) => task.status_code === "done").length;
        const delayedCount = unitTasks.filter((task) => task.display_status_code === "delayed").length;
        const pendingCount = Math.max(assignedCount - completedCount - delayedCount, 0);
        const completedAheadCount = unitTasks.filter((task) => getCompletionTimingCode(task) === "ahead").length;
        const completedOnTimeCount = unitTasks.filter((task) => getCompletionTimingCode(task) === "on_time").length;
        const completedLateCount = unitTasks.filter((task) => getCompletionTimingCode(task) === "late").length;

        return {
            order: index + 1,
            unit_code: orgUnit.code,
            unit_name: orgUnit.name,
            assigned_count: assignedCount,
            completed_count: completedCount,
            completed_ahead_count: completedAheadCount,
            completed_on_time_count: completedOnTimeCount,
            completed_late_count: completedLateCount,
            pending_count: pendingCount,
            delayed_count: delayedCount,
            kpi_a_score: assignedCount ? (completedCount / assignedCount) : 0,
            kpi_a_percent: assignedCount ? Math.round((completedCount / assignedCount) * 100) : 0
        };
    });

    const totals = units.reduce((aggregate, unit) => ({
        assigned_count: aggregate.assigned_count + unit.assigned_count,
        completed_count: aggregate.completed_count + unit.completed_count,
        completed_ahead_count: aggregate.completed_ahead_count + unit.completed_ahead_count,
        completed_on_time_count: aggregate.completed_on_time_count + unit.completed_on_time_count,
        completed_late_count: aggregate.completed_late_count + unit.completed_late_count,
        pending_count: aggregate.pending_count + unit.pending_count,
        delayed_count: aggregate.delayed_count + unit.delayed_count
    }), {
        assigned_count: 0,
        completed_count: 0,
        completed_ahead_count: 0,
        completed_on_time_count: 0,
        completed_late_count: 0,
        pending_count: 0,
        delayed_count: 0
    });

    return {
        month,
        assigned_count: totals.assigned_count,
        completed_count: totals.completed_count,
        units,
        totals: {
            ...totals,
            kpi_a_score: totals.assigned_count
                ? (totals.completed_count / totals.assigned_count)
                : 0,
            kpi_a_percent: totals.assigned_count
                ? Math.round((totals.completed_count / totals.assigned_count) * 100)
                : 0
        }
    };
}

module.exports = {
    getKpiMonthValueFromDate,
    getDueKpiMonth,
    getCompletedKpiMonth,
    getEffectiveKpiMonth,
    attachKpiAMetadata,
    filterTasksByKpiAMonth,
    getAssignedTaskCountByMonth,
    getCompletedTaskCountByMonth,
    buildKpiASummary
};
