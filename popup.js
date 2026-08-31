/* ========================================================
   CARECONNECT CUSTOM POPUP & TOAST JAVASCRIPT
   Replaces window.alert, window.confirm, window.prompt
======================================================== */

(function () {
    function ensurePopupDOM() {
        if (document.getElementById("care-popup-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "care-popup-overlay";
        overlay.innerHTML = `
            <div id="care-popup-box">
                <div id="care-popup-icon"></div>
                <h3 id="care-popup-title" style="display:none;"></h3>
                <p id="care-popup-message"></p>
                <input type="text" id="care-popup-input" style="display:none;" />
                <div class="care-popup-actions">
                    <button class="care-popup-btn care-popup-cancel-btn" id="care-popup-cancel" style="display:none;">Cancel</button>
                    <button class="care-popup-btn care-popup-confirm-btn" id="care-popup-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Toast container
        if (!document.getElementById("care-bottom-toast")) {
            const toast = document.createElement("div");
            toast.id = "care-bottom-toast";
            document.body.appendChild(toast);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensurePopupDOM);
    } else {
        ensurePopupDOM();
    }

    /**
     * Show custom popup modal matching the login greeting design
     */
    window.showCustomPopup = function ({
        title = "",
        message = "",
        type = "info", // "success", "error", "info"
        confirmText = "OK",
        cancelText = "",
        showInput = false,
        inputPlaceholder = "",
        inputValue = "",
        autoCloseMs = 0,
        onConfirm = null,
        onCancel = null
    }) {
        ensurePopupDOM();

        const overlay = document.getElementById("care-popup-overlay");
        const box = document.getElementById("care-popup-box");
        const titleEl = document.getElementById("care-popup-title");
        const msgEl = document.getElementById("care-popup-message");
        const inputEl = document.getElementById("care-popup-input");
        const okBtn = document.getElementById("care-popup-ok");
        const cancelBtn = document.getElementById("care-popup-cancel");

        box.className = "";
        box.classList.add(type);

        if (title) {
            titleEl.textContent = title;
            titleEl.style.display = "block";
        } else {
            titleEl.style.display = "none";
        }

        msgEl.textContent = message;

        if (showInput) {
            inputEl.style.display = "block";
            inputEl.placeholder = inputPlaceholder;
            inputEl.value = inputValue;
            setTimeout(() => inputEl.focus(), 100);
        } else {
            inputEl.style.display = "none";
        }

        okBtn.textContent = confirmText || "OK";

        if (cancelText) {
            cancelBtn.textContent = cancelText;
            cancelBtn.style.display = "inline-block";
        } else {
            cancelBtn.style.display = "none";
        }

        return new Promise((resolve) => {
            function close(result) {
                overlay.classList.remove("show");
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                overlay.onclick = null;
                if (autoTimer) clearTimeout(autoTimer);
                resolve(result);
            }

            okBtn.onclick = (e) => {
                e.stopPropagation();
                const val = showInput ? inputEl.value : true;
                if (onConfirm) onConfirm(val);
                close(val);
            };

            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                if (onCancel) onCancel();
                close(false);
            };

            // Overlay click dismisses if not a prompt/confirm
            overlay.onclick = (e) => {
                if (e.target === overlay && !cancelText && !showInput) {
                    close(true);
                }
            };

            // Allow Enter key inside input
            if (showInput) {
                inputEl.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        okBtn.click();
                    }
                };
            }

            overlay.classList.add("show");

            let autoTimer = null;
            if (autoCloseMs > 0) {
                autoTimer = setTimeout(() => {
                    close(true);
                }, autoCloseMs);
            }
        });
    };

    /**
     * Replaces alert()
     */
    window.customAlert = function (message, type = "info", title = "") {
        return window.showCustomPopup({
            title,
            message: String(message || ""),
            type,
            confirmText: "OK"
        });
    };

    /**
     * Replaces confirm()
     */
    window.customConfirm = function (message, title = "Confirm") {
        return window.showCustomPopup({
            title,
            message: String(message || ""),
            type: "info",
            confirmText: "Yes",
            cancelText: "No"
        });
    };

    /**
     * Replaces prompt()
     */
    window.customPrompt = function (message, defaultValue = "", title = "") {
        return window.showCustomPopup({
            title,
            message: String(message || ""),
            type: "info",
            showInput: true,
            inputValue: defaultValue,
            confirmText: "Submit",
            cancelText: "Cancel"
        });
    };

    /**
     * Bottom Toast Notification
     * (Styled to match the notification in appointments section)
     */
    window.showBottomToast = function (message, isError = false) {
        ensurePopupDOM();
        const toast = document.getElementById("care-bottom-toast");
        if (!toast) return;

        toast.textContent = message;
        toast.className = isError ? "show error" : "show";

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.className = "";
        }, 3200);
    };

    // Override native browser dialogs with custom versions
    window.alert = function (msg) {
        return window.customAlert(msg, "info");
    };
})();
export default window.showCustomPopup;
