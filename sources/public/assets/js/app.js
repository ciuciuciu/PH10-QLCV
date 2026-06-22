const App = (() => {
    let configCache = null;

    async function api(path, options = {}) {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const response = await fetch(path, {
            ...options,
            headers
        });

        const rawText = await response.text();
        let data = {};

        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (error) {
                data = {};
            }
        }

        if (!response.ok) {
            throw new Error(data.message || rawText || "Yêu cầu thất bại.");
        }

        return data;
    }

    async function getConfig() {
        if (!configCache) {
            configCache = await api("/api/config");
        }

        return configCache;
    }

    function setConfigCache(value) {
        configCache = value;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showMessage(message, type = "success") {
        const box = document.createElement("div");
        box.className = `message-box ${type === "error" ? "message-error" : "message-success"}`;
        box.textContent = message;
        document.body.appendChild(box);

        window.setTimeout(() => {
            box.remove();
        }, 2600);
    }

    function createEmptyState(text) {
        return `<div class="empty-table">${escapeHtml(text)}</div>`;
    }

    return {
        api,
        getConfig,
        setConfigCache,
        escapeHtml,
        showMessage,
        createEmptyState
    };
})();
