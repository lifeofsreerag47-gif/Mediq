import { db } from "../firebase.js";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const arrow = document.getElementById("arrow");
const gen = document.getElementById("gender");

if (gen && arrow) {
    gen.addEventListener("focus", () => {
    arrow.style.transform =
            "rotate(180deg) translateX(2px) translateY(0.5px) scale(1.2)";
    });
    
    gen.addEventListener("blur", () => {
        arrow.style.transform =
            "rotate(0deg) translateX(2px) translateY(0.5px) scale(1)";
    });
    arrow.addEventListener("click", () => {
        gen.focus();
        if (typeof gen.showPicker === "function") gen.showPicker();
    });
}

function showPopup(message, type = "info") {
    if (window.showCustomPopup) {
        return window.showCustomPopup({
            message,
            type,
            autoCloseMs: type === "success" ? 1800 : 0
        });
    }
    alert(message);
    return Promise.resolve();
}

/* ---------------- Signup logic ---------------- */

const fullname = document.getElementById("fullname");
const dob = document.getElementById("dob");
const phone = document.getElementById("phone");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const terms = document.getElementById("terms");
const submitBtn = document.getElementById("submit");

submitBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    // Basic validation
    if (
        !fullname.value.trim() ||
        !dob.value ||
        !gen.value ||
        !phone.value.trim() ||
        !email.value.trim() ||
        !password.value ||
        !confirmPassword.value
    ) {
        showPopup("Please fill in all fields.", "error");
        return;
    }

    if (password.value !== confirmPassword.value) {
        showPopup("Passwords do not match.", "error");
        return;
    }

    if (!terms.checked) {
        showPopup("Please agree to the Terms & Conditions.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account...";

    try {
        const cleanEmail = email.value.trim().toLowerCase();

        // Check whether this email already exists
        const q = query(
            collection(db, "patients"),
            where("email", "==", cleanEmail)
        );

        const existingUsers = await getDocs(q);

        if (!existingUsers.empty) {
            showPopup("An account with this email already exists. Please login instead.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Sign up";
            return;
        }

        // Default avatar

        // Store the patient's information in Firestore
        await addDoc(collection(db, "patients"), {
            fullname: fullname.value.trim(),
            dob: dob.value,
            gender: gen.value,
            phone: phone.value.trim(),
            email: cleanEmail,
            password: password.value,
            profilePicture: "",
            createdAt: new Date().toISOString()
        });

        await showPopup("Account created successfully! Redirecting to login...", "success");
        window.location.href = "../index.html";

    } catch (error) {
        console.error("Error creating account:", error);
        showPopup("Something went wrong. Please try again.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign up";
    }
});
