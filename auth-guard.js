/* ========================================================
   CARECONNECT AUTH GUARD & SESSION HELPER
======================================================== */

// Calculate root relative prefix
export function getRootPrefix() {
    const path = window.location.pathname.replace(/\\/g, "/").toLowerCase();
    if (
        path.includes("/home/find_doctors/") ||
        path.includes("/specialities/specialities/") ||
        path.includes("/hospital/hopital/") ||
        path.includes("/hopital/hopital/") ||
        path.includes("/doctor/doctor/")
    ) {
        return "../../";
    }
    if (path.endsWith("/index.html") || path.endsWith("/")) {
        return "./";
    }
    return "../";
}

export function getCurrentUser() {
    const userRole = localStorage.getItem("userRole"); // "patient" or "doctor"
    const patientId = localStorage.getItem("patientId");
    const doctorId = localStorage.getItem("doctorId");
    const userName = localStorage.getItem("userName");

    if (!userRole) return null;

    return {
        role: userRole,
        id: userRole === "doctor" ? doctorId : patientId,
        patientId,
        doctorId,
        name: userName || "User"
    };
}

export function isLoggedIn() {
    const user = getCurrentUser();
    return !!(user && user.id && user.role);
}

/**
 * Enforces authentication on protected pages.
 * If not logged in, redirects to index.html with an alert/toast.
 */
export function requireAuth(allowedRoles = ["patient", "doctor"]) {
    const user = getCurrentUser();
    const rootPrefix = getRootPrefix();

    if (!user || !user.id || !allowedRoles.includes(user.role)) {
        console.warn("Unauthenticated access to protected page. Redirecting to login...");
        window.location.href = rootPrefix + "index.html";
        return null;
    }
    return user;
}

/**
 * Logs out the user, clears session storage and redirects to Home page in logged-out state.
 */
export function logout() {
    localStorage.removeItem("userRole");
    localStorage.removeItem("patientId");
    localStorage.removeItem("doctorId");
    localStorage.removeItem("userName");

    const rootPrefix = getRootPrefix();
    window.location.href = rootPrefix + "home/home.html";
}

// Attach to window for non-module scripts
window.careAuth = {
    getRootPrefix,
    getCurrentUser,
    isLoggedIn,
    requireAuth,
    logout
};
