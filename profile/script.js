import { db } from "../firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ELEMENTS
const profileUpload = document.getElementById("profileUpload");
const profileImage = document.getElementById("profileImage");

// CLOUDINARY SETTINGS
const CLOUDINARY_CLOUD_NAME = "aso9zctl";
const CLOUDINARY_UPLOAD_PRESET = "DoctorCare";

// GET LOGGED-IN DOCTOR
const doctorId = localStorage.getItem("doctorId");
const userRole = localStorage.getItem("userRole");

// If there is no logged-in doctor, redirect to login
if (!doctorId || userRole !== "doctor") {
    window.location.href = "../index.html";
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

// LOAD DOCTOR PROFILE
async function loadDoctorProfile() {
    try {
        const doctorRef = doc(db, "doctors", doctorId);
        const doctorSnapshot = await getDoc(doctorRef);

        if (!doctorSnapshot.exists()) {
            console.error("Doctor account not found.");
            localStorage.removeItem("doctorId");
            window.location.href = "../index.html";
            return;
        }

        const doctorData = doctorSnapshot.data();

        // BASIC INFORMATION
        const nameEl = document.querySelector(".doctor-basic-info h1");
        if (nameEl) nameEl.textContent = doctorData.fullName || "Doctor";

        const specEl = document.querySelector(".doctor-basic-info .speciality");
        if (specEl) specEl.textContent = doctorData.specialization || "Specialist";

        const expEl = document.querySelector(".doctor-basic-info .experience");
        if (expEl) expEl.textContent = `${doctorData.experience || 0}+ Years Experience`;

        // DOCTOR DETAILS
        const detailBoxes = document.querySelectorAll(".details-container .detail-box");

        // Full Name
        if (detailBoxes[0]) {
            detailBoxes[0].querySelector("strong").textContent = doctorData.fullName || "Not available";
        }

        // Specialization
        if (detailBoxes[1]) {
            detailBoxes[1].querySelector("strong").textContent = doctorData.specialization || "Not available";
        }

        // Experience
        if (detailBoxes[2]) {
            detailBoxes[2].querySelector("strong").textContent = `${doctorData.experience || 0}+ Years`;
        }

        // License
        if (detailBoxes[4]) {
            detailBoxes[4].querySelector("strong").textContent = doctorData.license || "Not available";
        }

        // HOSPITAL DETAILS
        const hospitalName = typeof doctorData.hospital === "object"
            ? (doctorData.hospital?.name ? `${doctorData.hospital.name}, ${doctorData.hospital.location || ""}` : "CareConnect Hospital")
            : (doctorData.hospital || "Not available");

        const hospitalBox = document.querySelector(".hospital-grid .detail-box");
        if (hospitalBox) {
            hospitalBox.querySelector("strong").textContent = hospitalName;
        }

        // PROFILE PICTURE
        if (doctorData.profileImageURL && profileImage) {
            profileImage.src = doctorData.profileImageURL;
        }

    } catch (error) {
        console.error("Error loading doctor profile:", error);
    }
}

// UPLOAD PROFILE PICTURE
if (profileUpload) {
    profileUpload.addEventListener("change", async function () {
        const file = this.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showPopup("Please select a valid image file.", "error");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showPopup("Please select an image smaller than 5 MB.", "error");
            return;
        }

        try {
            if (profileImage) profileImage.src = URL.createObjectURL(file);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok) {
                console.error("Cloudinary error:", data);
                throw new Error(data.error?.message || "Cloudinary upload failed.");
            }

            const imageURL = data.secure_url;

            const doctorRef = doc(db, "doctors", doctorId);
            await updateDoc(doctorRef, { profileImageURL: imageURL });

            if (profileImage) profileImage.src = imageURL;
            showPopup("Profile picture updated successfully!", "success");

        } catch (error) {
            console.error("Profile picture upload error:", error);
            showPopup("Unable to update profile picture. Please try again.", "error");
        }
    });
}

loadDoctorProfile();