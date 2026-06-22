(async function initSettingsPage() {
    const navButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
    const panels = Array.from(document.querySelectorAll("[data-settings-tab]"));

    const saveGeneralButton = document.getElementById("saveGeneralButton");
    const kpiStartDaySelect = document.getElementById("kpiStartDaySelect");

    const assignersTableBody = document.getElementById("assignersTableBody");
    const addAssignerButton = document.getElementById("addAssignerButton");
    const saveAssignersButton = document.getElementById("saveAssignersButton");
    const newAssignerName = document.getElementById("newAssignerName");

    const orgUnitsTableBody = document.getElementById("orgUnitsTableBody");
    const addUnitButton = document.getElementById("addUnitButton");
    const saveUnitsButton = document.getElementById("saveUnitsButton");
    const newUnitName = document.getElementById("newUnitName");
    const newHeadName = document.getElementById("newHeadName");
    const newHeadTitle = document.getElementById("newHeadTitle");
    const newHeadRank = document.getElementById("newHeadRank");

    let generalSettings = { kpiStartDay: 1 };
    let assigners = [];
    let assignerCodes = new Set();
    let orgUnits = [];
    let unitCodes = new Set();

    function renderGeneralOptions(selectedDay) {
        kpiStartDaySelect.innerHTML = Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return `<option value="${day}"${day === selectedDay ? " selected" : ""}>Ngày ${day}</option>`;
        }).join("");
    }

    function activateTab(tabName) {
        navButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.tabTarget === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("active", panel.dataset.settingsTab === tabName);
        });
    }

    function getTabFromHash() {
        const hash = window.location.hash.replace("#", "").trim();
        return navButtons.some((button) => button.dataset.tabTarget === hash) ? hash : "general";
    }

    function bindNavigation() {
        navButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const tabName = button.dataset.tabTarget;
                activateTab(tabName);
                window.location.hash = tabName;
            });
        });

        window.addEventListener("hashchange", () => activateTab(getTabFromHash()));
    }

    function slugifyName(value) {
        const normalized = String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        return normalized || "item";
    }

    function createUniqueCode(name, usedCodes) {
        const baseCode = slugifyName(name);
        let nextCode = baseCode;
        let suffix = 2;

        while (usedCodes.has(nextCode)) {
            nextCode = `${baseCode}_${suffix}`;
            suffix += 1;
        }

        return nextCode;
    }

    function updateToggleLabel(target) {
        const label = target.closest(".toggle-wrap")?.querySelector("span");
        if (label) {
            label.textContent = target.checked ? "Đã tắt" : "Đang dùng";
        }
    }

    function renderAssigners() {
        if (!assigners.length) {
            assignersTableBody.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center empty-table">Chưa có lãnh đạo giao việc.</td>
                </tr>
            `;
            return;
        }

        assignersTableBody.innerHTML = assigners
            .map(
                (assigner, index) => `
                    <tr>
                        <td><input type="text" data-group="assigner" data-index="${index}" data-field="name" value="${App.escapeHtml(assigner.name || "")}"></td>
                        <td>
                            <label class="toggle-wrap">
                                <input type="checkbox" data-group="assigner" data-index="${index}" data-field="disabled" ${assigner.disabled ? "checked" : ""}>
                                <span>${assigner.disabled ? "Đã tắt" : "Đang dùng"}</span>
                            </label>
                        </td>
                    </tr>
                `
            )
            .join("");
    }

    function renderOrgUnits() {
        if (!orgUnits.length) {
            orgUnitsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center empty-table">Chưa có đơn vị trực thuộc.</td>
                </tr>
            `;
            return;
        }

        orgUnitsTableBody.innerHTML = orgUnits
            .map(
                (unit, index) => `
                    <tr>
                        <td><input type="text" data-group="unit" data-index="${index}" data-field="name" value="${App.escapeHtml(unit.name || "")}"></td>
                        <td><input type="text" data-group="unit" data-index="${index}" data-field="head_name" value="${App.escapeHtml(unit.head_name || "")}"></td>
                        <td><input type="text" data-group="unit" data-index="${index}" data-field="head_title" value="${App.escapeHtml(unit.head_title || "")}"></td>
                        <td><input type="text" data-group="unit" data-index="${index}" data-field="head_rank" value="${App.escapeHtml(unit.head_rank || "")}"></td>
                        <td>
                            <label class="toggle-wrap">
                                <input type="checkbox" data-group="unit" data-index="${index}" data-field="disabled" ${unit.disabled ? "checked" : ""}>
                                <span>${unit.disabled ? "Đã tắt" : "Đang dùng"}</span>
                            </label>
                        </td>
                    </tr>
                `
            )
            .join("");
    }

    function resetNewAssignerForm() {
        newAssignerName.value = "";
    }

    function resetNewUnitForm() {
        newUnitName.value = "";
        newHeadName.value = "";
        newHeadTitle.value = "";
        newHeadRank.value = "";
    }

    function addAssigner() {
        const name = newAssignerName.value.trim();
        const assigner = {
            name,
            code: createUniqueCode(name, assignerCodes),
            disabled: false
        };

        if (!assigner.name) {
            App.showMessage("Vui lòng nhập tên lãnh đạo mới.", "error");
            return;
        }

        assigners.push(assigner);
        assignerCodes.add(assigner.code);
        renderAssigners();
        resetNewAssignerForm();
        App.showMessage("Đã thêm lãnh đạo giao việc mới.");
    }

    function addUnit() {
        const name = newUnitName.value.trim();
        const unit = {
            name,
            code: createUniqueCode(name, unitCodes),
            head_name: newHeadName.value.trim(),
            head_title: newHeadTitle.value.trim(),
            head_rank: newHeadRank.value.trim(),
            disabled: false
        };

        if (!unit.name || !unit.head_name || !unit.head_title || !unit.head_rank) {
            App.showMessage("Vui lòng nhập đủ thông tin cho đơn vị mới.", "error");
            return;
        }

        orgUnits.push(unit);
        unitCodes.add(unit.code);
        renderOrgUnits();
        resetNewUnitForm();
        App.showMessage("Đã thêm đơn vị mới vào danh sách.");
    }

    function syncRowChange(target) {
        const group = target.dataset.group;
        const index = Number(target.dataset.index);
        const field = target.dataset.field;

        if (!Number.isInteger(index) || !field) {
            return;
        }

        if (group === "assigner" && assigners[index]) {
            assigners[index][field] = field === "disabled" ? target.checked : target.value;
            if (field === "disabled") {
                updateToggleLabel(target);
            }
            return;
        }

        if (group === "unit" && orgUnits[index]) {
            orgUnits[index][field] = field === "disabled" ? target.checked : target.value;
            if (field === "disabled") {
                updateToggleLabel(target);
            }
        }
    }

    async function saveGeneralSettings() {
        const kpiStartDay = Number(kpiStartDaySelect.value);

        try {
            const result = await App.api("/api/settings/general", {
                method: "PUT",
                body: JSON.stringify({ kpiStartDay })
            });

            generalSettings = result.generalSettings || { kpiStartDay: 1 };
            renderGeneralOptions(Number(generalSettings.kpiStartDay) || 1);
            App.setConfigCache(null);
            App.showMessage(result.message || "Đã cập nhật cài đặt chung.");
        } catch (error) {
            App.showMessage(error.message, "error");
        }
    }

    async function saveAssigners() {
        const invalidAssigner = assigners.find(
            (item) => !String(item.name || "").trim() || !String(item.code || "").trim()
        );

        if (invalidAssigner) {
            App.showMessage("Vui lòng điền đầy đủ thông tin cho tất cả lãnh đạo.", "error");
            return;
        }

        try {
            const result = await App.api("/api/settings/assigners", {
                method: "PUT",
                body: JSON.stringify({ assigners })
            });

            assigners = result.assigners || [];
            assignerCodes = new Set(assigners.map((item) => item.code));
            App.setConfigCache(null);
            renderAssigners();
            App.showMessage(result.message || "Đã lưu thay đổi.");
        } catch (error) {
            App.showMessage(error.message, "error");
        }
    }

    async function saveUnits() {
        const invalidUnit = orgUnits.find(
            (item) => !String(item.name || "").trim()
                || !String(item.code || "").trim()
                || !String(item.head_name || "").trim()
                || !String(item.head_title || "").trim()
                || !String(item.head_rank || "").trim()
        );

        if (invalidUnit) {
            App.showMessage("Vui lòng điền đầy đủ thông tin cho tất cả đơn vị.", "error");
            return;
        }

        try {
            const result = await App.api("/api/settings/org-units", {
                method: "PUT",
                body: JSON.stringify({ orgUnits })
            });

            orgUnits = result.orgUnits || [];
            unitCodes = new Set(orgUnits.map((item) => item.code));
            App.setConfigCache(null);
            renderOrgUnits();
            App.showMessage(result.message || "Đã lưu thay đổi.");
        } catch (error) {
            App.showMessage(error.message, "error");
        }
    }

    const [generalResult, assignersResult, orgUnitsResult] = await Promise.allSettled([
        App.api("/api/settings/general"),
        App.api("/api/settings/assigners"),
        App.api("/api/settings/org-units")
    ]);

    if (generalResult.status === "fulfilled") {
        generalSettings = generalResult.value.generalSettings || { kpiStartDay: 1 };
        renderGeneralOptions(Number(generalSettings.kpiStartDay) || 1);
    } else {
        renderGeneralOptions(1);
        App.showMessage(generalResult.reason?.message || "Không thể tải cài đặt chung.", "error");
    }

    if (assignersResult.status === "fulfilled") {
        assigners = assignersResult.value.assigners || [];
        assignerCodes = new Set(assigners.map((item) => item.code));
        renderAssigners();
    } else {
        assignersTableBody.innerHTML = `
            <tr>
                <td colspan="2" class="text-center empty-table">Không thể tải danh sách lãnh đạo.</td>
            </tr>
        `;
        App.showMessage(assignersResult.reason?.message || "Không thể tải danh sách lãnh đạo.", "error");
    }

    if (orgUnitsResult.status === "fulfilled") {
        orgUnits = orgUnitsResult.value.orgUnits || [];
        unitCodes = new Set(orgUnits.map((item) => item.code));
        renderOrgUnits();
    } else {
        orgUnitsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-table">Không thể tải danh sách đơn vị.</td>
            </tr>
        `;
        App.showMessage(orgUnitsResult.reason?.message || "Không thể tải danh sách đơn vị.", "error");
    }

    bindNavigation();
    activateTab(getTabFromHash());

    saveGeneralButton.addEventListener("click", saveGeneralSettings);
    addAssignerButton.addEventListener("click", addAssigner);
    saveAssignersButton.addEventListener("click", saveAssigners);
    addUnitButton.addEventListener("click", addUnit);
    saveUnitsButton.addEventListener("click", saveUnits);
    assignersTableBody.addEventListener("input", (event) => syncRowChange(event.target));
    assignersTableBody.addEventListener("change", (event) => syncRowChange(event.target));
    orgUnitsTableBody.addEventListener("input", (event) => syncRowChange(event.target));
    orgUnitsTableBody.addEventListener("change", (event) => syncRowChange(event.target));
})();
