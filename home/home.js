// Home page interactivity and ambient lights

// Navigation protection check for links
document.querySelectorAll(".hero-actions a, .quick-grid a").forEach((link) => {
    link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (href && href !== "#" && !href.startsWith("http")) {
            const userRole = localStorage.getItem("userRole");
            // If clicking appointments or find doctors and not logged in
            if (!userRole && (href.includes("appoint") || href.includes("Find_doctors") || href.includes("profile"))) {
                e.preventDefault();
                if (window.showCustomPopup) {
                    window.showCustomPopup({
                        title: "Login Required",
                        message: "Please log in to access this feature.",
                        type: "info",
                        confirmText: "Go to Login",
                        onConfirm: () => {
                            window.location.href = "../index.html";
                        }
                    });
                } else {
                    window.location.href = "../index.html";
                }
            }
        }
    });
});

/* ==========================================
   ✨ MAGNETIC AMBIENT LIGHT
========================================== */

let ambientEl = document.getElementById("ambient-light");
if (!ambientEl) {
    ambientEl = document.createElement("div");
    ambientEl.id = "ambient-light";
    document.body.appendChild(ambientEl);
}

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let currentX = mouseX;
let currentY = mouseY;

document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    document.body.classList.add("ambient-active");
});

// Small fading cursor trail
let lastTrailTime = 0;

document.addEventListener("pointermove", (event) => {
    // No cursor trail on touch devices
    if (event.pointerType !== "mouse") return;

    const now = Date.now();

    // Create only a few trail dots, not one for every movement
    if (now - lastTrailTime < 45) return;
    lastTrailTime = now;

    const trail = document.createElement("span");
    const size = Math.floor(Math.random() * 4) + 7; // 7px–10px

    trail.className = "cursor-trail";
    trail.style.left = `${event.clientX}px`;
    trail.style.top = `${event.clientY}px`;
    trail.style.width = `${size}px`;
    trail.style.height = `${size}px`;

    document.body.appendChild(trail);

    trail.addEventListener("animationend", () => trail.remove());
});

function animateAmbientLight() {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;

    document.body.style.setProperty("--mouse-x", `${currentX}px`);
    document.body.style.setProperty("--mouse-y", `${currentY}px`);

    requestAnimationFrame(animateAmbientLight);
}

animateAmbientLight();

document.addEventListener("mouseleave", () => {
    document.body.classList.remove("ambient-active");
});
