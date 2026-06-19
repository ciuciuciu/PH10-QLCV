const fs = require("fs");
const path = require("path");

const CONFIG_FILE_PATH = path.join(__dirname, "master-data.json");

function buildMasterData(rawData) {
    const data = rawData || {};
    const assigners = Array.isArray(data.assigners)
        ? data.assigners.map((item) => ({
            code: item.code,
            name: item.name,
            disabled: Boolean(item.disabled)
        }))
        : [];
    const orgUnits = Array.isArray(data.orgUnits)
        ? data.orgUnits.map((item) => ({
            ...item,
            disabled: Boolean(item.disabled)
        }))
        : [];
    const taskStatuses = Array.isArray(data.taskStatuses) ? data.taskStatuses : [];
    const priorityLevels = Array.isArray(data.priorityLevels) ? data.priorityLevels : [];
    const generalSettings = {
        kpiStartDay: 1,
        ...(data.generalSettings || {})
    };

    return {
        assigners,
        orgUnits,
        taskStatuses,
        priorityLevels,
        generalSettings,
        taskStatusLookup: Object.fromEntries(taskStatuses.map((item) => [item.code, item])),
        priorityLookup: Object.fromEntries(priorityLevels.map((item) => [item.code, item]))
    };
}

function getMasterData() {
    const rawText = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
    return buildMasterData(JSON.parse(rawText));
}

function saveMasterData(data) {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
    return buildMasterData(data);
}

module.exports = {
    getMasterData,
    saveMasterData
};
