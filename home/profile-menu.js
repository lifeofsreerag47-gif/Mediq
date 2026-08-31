import { db } from "../firebase.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const loginBtn = document.getElementById("loginBtn");
const profileMenu = document.getElementById("profileMenu");
const profileTrigger = document.getElementById("profileTrigger");
const logoutBtn = document.getElementById("logoutBtn");
const myProfileBtn = document.getElementById("myProfileBtn");

const navProfileImage = document.getElementById("navProfileImage");
const dropdownProfileImage = document.getElementById("dropdownProfileImage");
const dropdownUserName = document.getElementById("dropdownUserName");
const dropdownUserRole = document.getElementById("dropdownUserRole");

const heroTitle = document.getElementById("heroTitle");
const heroDescription = document.getElementById("heroDescription");

async function loadProfileMenu() {
    const userRole = localStorage.getItem("userRole");
    const userId = userRole === "patient"
        ? localStorage.getItem("patientId")
        : localStorage.getItem("doctorId");

    // ==========================================
    // NOT LOGGED IN STATE
    // ==========================================
    if (!userRole || !userId) {
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (profileMenu) profileMenu.style.display = "none";

        // Keep default public hero greeting (No personalized login greeting)
        if (heroTitle) {
            heroTitle.innerHTML = `Find the right care.<br><em>Without the waiting.</em>`;
        }
        if (heroDescription) {
            heroDescription.textContent = "Discover trusted doctors, book appointments, and plan your visit with a smarter healthcare experience.";
        }
        return;
    }

    // ==========================================
    // LOGGED IN STATE
    // ==========================================
    if (loginBtn) loginBtn.style.display = "none";
    if (profileMenu) profileMenu.style.display = "block";

    const collectionName = userRole === "patient" ? "patients" : "doctors";

    try {
        const userRef = doc(db, collectionName, userId);
        const userSnap = await getDoc(userRef);

        let name = localStorage.getItem("userName") || (userRole === "patient" ? "Patient" : "Doctor");
        let profilePic = "";

        if (userSnap.exists()) {
            const data = userSnap.data();
            name = userRole === "patient" ? (data.fullname || name) : (data.fullName || name);
            profilePic = userRole === "patient" ? data.profilePicture : data.profileImageURL;
            localStorage.setItem("userName", name);
        }

        if (dropdownUserName) dropdownUserName.textContent = name;
        if (dropdownUserRole) dropdownUserRole.textContent = userRole === "patient" ? "Patient" : "Doctor";

        // Personalized hero greeting only when logged in
        if (heroTitle && heroDescription && name) {
            const hour = new Date().getHours();
            let greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
            const firstName = name.trim().split(" ")[0];

            heroTitle.innerHTML = `${greeting}, ${firstName}.<br><em>Your health, made simpler.</em>`;
            heroDescription.textContent = "Everything you need for a simpler healthcare experience, all in one place.";
        }

        const defaultImage =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2331568F'/%3E%3Ccircle cx='50' cy='38' r='18' fill='white'/%3E%3Cpath d='M15 90c5-22 20-32 35-32s30 10 35 32' fill='white'/%3E%3C/svg%3E";

        const finalImage = profilePic || defaultImage;
        if (navProfileImage) navProfileImage.src = finalImage;
        if (dropdownProfileImage) dropdownProfileImage.src = finalImage;

    } catch (error) {
        console.error("Error loading profile menu:", error);
    }
}

// Open / Close dropdown
if (profileTrigger && profileMenu) {
    profileTrigger.addEventListener("click", (event) => {
        event.stopPropagation();
        profileMenu.classList.toggle("open");
    });

    document.addEventListener("click", () => {
        profileMenu.classList.remove("open");
    });
}

// Profile navigation
if (myProfileBtn) {
    myProfileBtn.addEventListener("click", () => {
        const userRole = localStorage.getItem("userRole");
        if (userRole === "patient") {
            window.location.href = "../profilepatient/profilepatient.html";
        } else if (userRole === "doctor") {
            window.location.href = "../profile/profile.html";
        } else {
            window.location.href = "../index.html";
        }
    });
}

// Login
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        window.location.href = "../index.html";
    });
}

// Logout -> redirect to Home page in logged out state
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("userRole");
        localStorage.removeItem("patientId");
        localStorage.removeItem("doctorId");
        localStorage.removeItem("userName");

        // Reload home page in logged out state
        window.location.href = "home.html";
    });
}

loadProfileMenu();
