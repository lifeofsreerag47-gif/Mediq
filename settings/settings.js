const themeToggle = document.getElementById("themeToggle");
const themeBadgeIcon = document.getElementById("themeBadgeIcon");
const themeBadgeText = document.getElementById("themeBadgeText");
const themeSwitchDesc = document.getElementById("themeSwitchDesc");
const logoutBtn = document.getElementById("logoutBtn");

function updateThemeUI(theme) {
    const isDark = (theme === "dark");

    if (themeToggle) {
        themeToggle.checked = isDark;
    }

    if (isDark) {
        document.documentElement.classList.add("dark-mode");
        if (themeBadgeIcon) themeBadgeIcon.textContent = "🌙";
        if (themeBadgeText) themeBadgeText.textContent = "Dark Mode";
        if (themeSwitchDesc) themeSwitchDesc.textContent = "Comfortable, low-light viewing experience";
    } else {
        document.documentElement.classList.remove("dark-mode");
        if (themeBadgeIcon) themeBadgeIcon.textContent = "☀️";
        if (themeBadgeText) themeBadgeText.textContent = "Light Mode";
        if (themeSwitchDesc) themeSwitchDesc.textContent = "Clean and bright day-time interface";
    }
}

// Apply saved theme when page loads
const savedTheme = localStorage.getItem("theme") || "light";
updateThemeUI(savedTheme);

// ===============================
// CHANGE THEME (DYNAMIC SWITCH)
// ===============================

if (themeToggle) {
    themeToggle.addEventListener("change", () => {
        const newTheme = themeToggle.checked ? "dark" : "light";
        localStorage.setItem("theme", newTheme);
        updateThemeUI(newTheme);
    });
}

// ===============================
// LOGOUT
// ===============================

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("userRole");
        localStorage.removeItem("patientId");
        localStorage.removeItem("doctorId");
        localStorage.removeItem("userName");

        window.location.href = "../home/home.html";
    });
}