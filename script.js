import { db } from "./firebase.js";
import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const slider = document.querySelector(".slider");
const pat = document.getElementById("pat");
const doc = document.getElementById("doc");
const Ppass = document.getElementById("Ppass");
const hide = document.getElementById("hidpass");
const show = document.getElementById("showpass");
const body = document.body;
const place = document.getElementById("pid");
const sign = document.getElementById("signup");
const loginBtn = document.getElementById("submit");

let trigger = true; // true = Patient, false = Doctor

// Switch to Patient Tab
pat.addEventListener("click", () => {
    slider.style.transform = "translateX(0)";
    pat.style.color = "white";
    doc.style.color = "black";
    body.style.backgroundImage = "url(patient.png)";
    place.placeholder = "Patient Email";
    trigger = true;
});

// Switch to Doctor Tab
doc.addEventListener("click", () => {
    slider.style.transform = "translateX(111%)";
    doc.style.color = "white";
    pat.style.color = "black";
    body.style.backgroundImage = "url(doctor.png)";
    place.placeholder = "Doctor Email";
    trigger = false;
});

// Password Toggle
show.onclick = function () {
    Ppass.type = "text";
    show.style.display = "none";
    hide.style.display = "inline";
};
hide.onclick = function () {
    Ppass.type = "password";
    hide.style.display = "none";
    show.style.display = "inline";
};

// Sign up redirect
sign.addEventListener("click", () => {
    if (!trigger) {
        window.location.href = "doctor/doctor/doctor.html";
    } else {
        window.location.href = "Patient_signup/index.html";
    }
});

/* ---------------- Popup helper ---------------- */
const popupOverlay = document.getElementById("popup-overlay");
const popupBox = document.getElementById("popup-box");
const popupMessage = document.getElementById("popup-message");
const popupClose = document.getElementById("popup-close");

function showPopup(message, type) {
    if (window.showCustomPopup) {
        window.showCustomPopup({
            message,
            type,
            autoCloseMs: type === "success" ? 1500 : 0
        });
        return;
    }
    popupBox.classList.remove("error", "success");
    popupBox.classList.add(type);
    popupMessage.textContent = message;
    popupOverlay.classList.add("show");
}

function hidePopup() {
    popupOverlay.classList.remove("show");
}

if (popupClose) popupClose.addEventListener("click", hidePopup);
if (popupOverlay) {
    popupOverlay.addEventListener("click", (event) => {
        if (event.target === popupOverlay) hidePopup();
    });
}

/* ---------------- Login logic ---------------- */

async function handleLogin() {
    const enteredEmail = place.value.trim().toLowerCase();
    const enteredPassword = Ppass.value;

    if (!enteredEmail || !enteredPassword) {
        showPopup("Please enter both your email and password.", "error");
        return;
    }

    loginBtn.disabled = true;


    try {
        const userCollection = trigger ? "patients" : "doctors";

        // Query Firestore by email
        const q = query(
            collection(db, userCollection),
            where("email", "==", enteredEmail)
        );

        const result = await getDocs(q);

        if (result.empty) {
            const userType = trigger ? "patient" : "doctor";
            showPopup(`No ${userType} account found with that email.`, "error");
            loginBtn.disabled = false;
            loginBtn.textContent = "Login";
            return;
        }

        const userDoc = result.docs[0];
        const userData = userDoc.data();

        if (userData.password !== enteredPassword) {
            showPopup("Incorrect password. Please try again.", "error");
            loginBtn.disabled = false;
            loginBtn.textContent = "Login";
            return;
        }

        const name = trigger ? (userData.fullname || "Patient") : (userData.fullName || "Doctor");

        // Save persistent login info in localStorage
        if (trigger) {
            localStorage.setItem("userRole", "patient");
            localStorage.setItem("patientId", userDoc.id);
            localStorage.setItem("userName", name);
            localStorage.removeItem("doctorId");
        } else {
            localStorage.setItem("userRole", "doctor");
            localStorage.setItem("doctorId", userDoc.id);
            localStorage.setItem("userName", name);
            localStorage.removeItem("patientId");
        }

        // Show welcome greeting popup
        showPopup(`Welcome back, ${name}!`, "success");

        setTimeout(() => {
            window.location.href = "home/home.html";
        }, 1200);

    } catch (error) {
        console.error("Login error:", error);
        showPopup("Unable to connect to database. Please check your network.", "error");
        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    }
}

loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    handleLogin();
});

// Allow Enter key submission on input fields
[place, Ppass].forEach((input) => {
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleLogin();
        }
    });
});