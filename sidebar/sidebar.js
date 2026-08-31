// ==========================================================================
// CARECONNECT — SIDEBAR NAVIGATION & APPOINTMENT NOTIFICATION ENGINE
// ==========================================================================

// Relative path resolution based on current page directory depth
function getRootPrefix() {
    const path = window.location.pathname.replace(/\\/g, "/").toLowerCase();
    
    // Check if the current page is 2 levels deep from project root
    if (
        path.includes("/home/find_doctors/") ||
        path.includes("/specialities/specialities/") ||
        path.includes("/hospital/hopital/") ||
        path.includes("/hopital/hopital/") ||
        path.includes("/doctor/doctor/")
    ) {
        return "../../";
    }
    
    // Check if the current page is directly at project root
    if (path.endsWith("/index.html") || path.endsWith("/") || path.endsWith("/index")) {
        return "./";
    }

    // Default for 1 level deep (home/, appoint/, profile/, profilepatient/, settings/, Patient_signup/)
    return "../";
}

const pages = {
    home: "home/home.html",
    appointments: "appoint/appoint.html",
    doctors: "home/Find_doctors/fincdoc.html",
    specialties: "Specialities/Specialities/special.html",
    settings: "settings/settings.html"
};

// Smooth connected page navigation helper
function navigateWithTransition(targetUrl) {
    if (!targetUrl) return;

    // Check if already on this target page
    const currentUrl = window.location.href.split(/[?#]/)[0].toLowerCase();
    const resolvedTarget = new URL(targetUrl, window.location.href).href.toLowerCase();
    if (currentUrl === resolvedTarget) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    // Trigger subtle exit transition
    document.body.classList.add("cc-page-transitioning");

    setTimeout(() => {
        window.location.href = targetUrl;
    }, 140);
}

// Reset page transition class if returned via browser back/forward cache
window.addEventListener("pageshow", () => {
    document.body.classList.remove("cc-page-transitioning");
});

// ==========================================================================
// SIDEBAR CLICK HANDLER
// ==========================================================================

document.addEventListener("click", (e) => {
    const menuItem = e.target.closest(".menu-item");
    if (!menuItem) return;

    const page = menuItem.dataset.page;
    if (!page) return;

    e.preventDefault();

    const rootPrefix = getRootPrefix();
    const userRole = localStorage.getItem("userRole");

    // Home is public
    if (page === "home") {
        navigateWithTransition(rootPrefix + pages.home);
        return;
    }

    // Protected pages require authentication
    if (!userRole) {
        if (window.showCustomPopup) {
            window.showCustomPopup({
                title: "Login Required",
                message: "Please log in to access this feature.",
                type: "info",
                confirmText: "Go to Login",
                onConfirm: () => {
                    navigateWithTransition(rootPrefix + "index.html");
                }
            });
        } else {
            navigateWithTransition(rootPrefix + "index.html");
        }
        return;
    }

    // 👤 Open the correct profile based on user role
    if (page === "profile") {
        if (userRole === "doctor") {
            navigateWithTransition(rootPrefix + "profile/profile.html");
        } else if (userRole === "patient") {
            navigateWithTransition(rootPrefix + "profilepatient/profilepatient.html");
        } else {
            navigateWithTransition(rootPrefix + "index.html");
        }
        return;
    }

    // If navigating to appointments, mark all doctor notifications as seen
    if (page === "appointments") {
        if (userRole === "doctor") {
            markAllDoctorAppointmentsAsSeen();
        }
        navigateWithTransition(rootPrefix + pages.appointments);
        return;
    }

    // Normal page navigation
    if (pages[page]) {
        navigateWithTransition(rootPrefix + pages[page]);
    }
});

// ==========================================================================
// ⭐ SET ACTIVE PAGE AUTOMATICALLY
// ==========================================================================

function setActivePage() {
    const currentPath = window.location.pathname.replace(/\\/g, "/").toLowerCase();

    // sidebar.html is injected into pages at different folder depths. Resolve the
    // logo from the project root so the same asset works on every route.
    document.querySelectorAll(".sidebar-logo").forEach((logo) => {
        logo.src = getRootPrefix() + "sidebar/logoMQ.png";
    });

    document.querySelectorAll(".menu-item").forEach((item) => {
        const page = item.dataset.page;

        // Remove active state from everything first
        item.classList.remove("active");

        if (page === "home" && (currentPath.endsWith("/home/home.html") || currentPath.endsWith("/home.html"))) {
            item.classList.add("active");
        } else if (page === "appointments" && (currentPath.includes("appoint/appoint.html") || currentPath.includes("appoint.html"))) {
            item.classList.add("active");
        } else if (page === "doctors" && (currentPath.includes("findoc") || currentPath.includes("fincdoc") || currentPath.includes("find_doctor") || currentPath.includes("find_doctors"))) {
            item.classList.add("active");
        } else if (page === "specialties" && (currentPath.includes("special.html") || currentPath.includes("specialities"))) {
            item.classList.add("active");
        } else if (page === "profile" && (currentPath.includes("profilepatient.html") || currentPath.includes("profile/profile.html") || currentPath.endsWith("/profile.html"))) {
            item.classList.add("active");
        } else if (page === "settings" && currentPath.includes("settings.html")) {
            item.classList.add("active");
        }
    });

    // If current page is appointments and doctor is logged in, clear seen appointments
    if ((currentPath.includes("appoint/appoint.html") || currentPath.includes("appoint.html")) && localStorage.getItem("userRole") === "doctor") {
        markAllDoctorAppointmentsAsSeen();
    }
}

// Ensure active page is set on DOM load and sidebar insertion
document.addEventListener("DOMContentLoaded", setActivePage);

// ==========================================================================
// 🔔 DOCTOR REAL-TIME APPOINTMENT NOTIFICATION & BADGE SYSTEM
// ==========================================================================

let doctorKnownApptIds = new Set();
let isInitialNotificationSnapshot = true;

function getSeenAppointmentIds() {
    try {
        const raw = localStorage.getItem("careconnect_doctor_seen_appts");
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function markAllDoctorAppointmentsAsSeen() {
    try {
        const seen = getSeenAppointmentIds();
        const combined = Array.from(new Set([...seen, ...doctorKnownApptIds]));
        localStorage.setItem("careconnect_doctor_seen_appts", JSON.stringify(combined));
        updateBadgeUI(0);
    } catch (e) {
        console.warn("Could not mark appointments as seen:", e);
    }
}

function updateBadgeUI(unreadCount) {
    const badge = document.getElementById("appointmentsBadge");
    if (!badge) return;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
        badge.style.display = "flex";
        badge.classList.add("active");
        badge.setAttribute("title", `${unreadCount} unread appointment${unreadCount > 1 ? "s" : ""}`);
    } else {
        badge.textContent = "";
        badge.style.display = "none";
        badge.classList.remove("active");
        badge.removeAttribute("title");
    }
}

// Display modern notification toast alert
function showAppointmentNotificationToast(appt) {
    // Only show toast if not already on the appointments page
    const currentPath = window.location.pathname.replace(/\\/g, "/").toLowerCase();
    if (currentPath.includes("appoint/appoint.html") || currentPath.includes("appoint.html")) {
        return;
    }

    let container = document.getElementById("careconnect-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "careconnect-toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "cc-toast-alert";

    const patientName = appt.patientName || "New Patient";
    const apptDate = appt.date || "Today";
    const apptSlot = appt.timeSlot || appt.time || "Scheduled Slot";
    const apptNotes = appt.notes ? `"${appt.notes.length > 50 ? appt.notes.substring(0, 50) + "..." : appt.notes}"` : "General consultation requested";

    toast.innerHTML = `
        <div class="cc-toast-header">
            <div class="cc-toast-badge">
                <span class="toast-bell">🔔</span>
                <span>New Appointment Request</span>
            </div>
            <button class="cc-toast-close" type="button" aria-label="Dismiss notification">✕</button>
        </div>
        <div class="cc-toast-body">
            <strong>${escapeHtmlText(patientName)}</strong>
            <div class="cc-toast-meta">
                <span>📅 ${escapeHtmlText(apptDate)}</span>
                <span>⏰ ${escapeHtmlText(apptSlot)}</span>
            </div>
            <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">${escapeHtmlText(apptNotes)}</p>
        </div>
        <div class="cc-toast-actions">
            <button class="cc-toast-btn primary" type="button">View Appointment</button>
            <button class="cc-toast-btn secondary" type="button">Dismiss</button>
        </div>
        <div class="cc-toast-progress"></div>
    `;

    container.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    const dismissToast = () => {
        toast.classList.remove("show");
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 350);
    };

    // Close on button clicks
    const closeBtn = toast.querySelector(".cc-toast-close");
    const secBtn = toast.querySelector(".cc-toast-btn.secondary");
    const priBtn = toast.querySelector(".cc-toast-btn.primary");

    if (closeBtn) closeBtn.addEventListener("click", dismissToast);
    if (secBtn) secBtn.addEventListener("click", dismissToast);
    
    if (priBtn) {
        priBtn.addEventListener("click", () => {
            dismissToast();
            markAllDoctorAppointmentsAsSeen();
            const rootPrefix = getRootPrefix();
            navigateWithTransition(rootPrefix + pages.appointments);
        });
    }

    // Auto dismiss after 6 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            dismissToast();
        }
    }, 6000);
}

function escapeHtmlText(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

// Initialize Doctor Real-time Firebase Listener
async function initDoctorNotificationListener() {
    const userRole = localStorage.getItem("userRole");
    const doctorId = localStorage.getItem("doctorId");
    const doctorName = localStorage.getItem("userName");

    if (userRole !== "doctor" || (!doctorId && !doctorName)) {
        return; // Notifications only for authenticated doctors
    }

    try {
        const rootPrefix = getRootPrefix();
        const { db } = await import(rootPrefix + "firebase.js");
        const { collection, onSnapshot } = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");

        onSnapshot(collection(db, "appointments"), (snapshot) => {
            const currentDoctorAppointments = [];

            snapshot.forEach((docSnap) => {
                const appt = { id: docSnap.id, ...docSnap.data() };
                
                // Match by doctorId or doctorName
                const isForThisDoc = (doctorId && appt.doctorId === doctorId) || 
                                     (doctorName && appt.doctorName && appt.doctorName.toLowerCase().includes(doctorName.toLowerCase()));

                if (isForThisDoc && appt.status !== "cancelled" && appt.status !== "completed") {
                    currentDoctorAppointments.push(appt);
                }
            });

            // Track known appointment IDs
            const prevKnownIds = new Set(doctorKnownApptIds);
            doctorKnownApptIds = new Set(currentDoctorAppointments.map(a => a.id));

            // Calculate unread items
            const seenIds = new Set(getSeenAppointmentIds());
            const unreadAppts = currentDoctorAppointments.filter(a => !seenIds.has(a.id));

            // Check if current page is appointments
            const currentPath = window.location.pathname.replace(/\\/g, "/").toLowerCase();
            const isOnAppointmentsPage = currentPath.includes("appoint/appoint.html") || currentPath.includes("appoint.html");

            if (isOnAppointmentsPage) {
                // Auto mark seen on appointments page
                markAllDoctorAppointmentsAsSeen();
                updateBadgeUI(0);
            } else {
                updateBadgeUI(unreadAppts.length);

                // If not initial load, trigger notification toast for newly arrived appointments
                if (!isInitialNotificationSnapshot) {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            const newAppt = { id: change.doc.id, ...change.doc.data() };
                            const isMatch = (doctorId && newAppt.doctorId === doctorId) ||
                                            (doctorName && newAppt.doctorName && newAppt.doctorName.toLowerCase().includes(doctorName.toLowerCase()));
                            
                            if (isMatch && newAppt.status !== "cancelled" && newAppt.status !== "completed" && !prevKnownIds.has(newAppt.id)) {
                                showAppointmentNotificationToast(newAppt);
                            }
                        }
                    });
                }
            }

            isInitialNotificationSnapshot = false;
        }, (err) => {
            console.warn("Real-time notification listener note:", err);
        });

    } catch (e) {
        console.warn("Notification listener initialization fallback:", e);
    }
}

// Start notification listener
initDoctorNotificationListener();

