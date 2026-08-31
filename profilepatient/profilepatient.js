import { db } from "../firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "aso9zctl";
const CLOUDINARY_UPLOAD_PRESET = "DoctorCare";

async function uploadToCloudinary(file) {
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

    if (!response.ok) {
        throw new Error("Failed to upload image to Cloudinary");
    }

    const data = await response.json();
    return data.secure_url;
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

// ==========================================
// LOAD PATIENT PROFILE
// ==========================================

async function loadPatientProfile() {
    const patientId = localStorage.getItem("patientId");
    const userRole = localStorage.getItem("userRole");

    if (!patientId || userRole !== "patient") {
        window.location.href = "../index.html";
        return;
    }

    try {
        const docRef = doc(db, "patients", patientId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            document.getElementById("patient-name-header").textContent = data.fullname || "Patient";
            document.getElementById("p-fullname").textContent = data.fullname || "N/A";
            document.getElementById("p-dob").textContent = data.dob || "N/A";
            document.getElementById("p-gender").textContent = data.gender || "N/A";
            document.getElementById("p-phone").textContent = data.phone || "N/A";
            document.getElementById("p-email").textContent = data.email || "N/A";

            const profileImage = document.getElementById("profile-image");
            if (data.profilePicture && profileImage) {
                profileImage.src = data.profilePicture;
            }
        } else {
            console.error("No patient record found in Firestore.");
            localStorage.removeItem("patientId");
            window.location.href = "../index.html";
        }
    } catch (error) {
        console.error("Error fetching patient profile:", error);
    }
}

// ==========================================
// PROFILE PICTURE UPLOAD
// ==========================================

const editProfilePicture = document.getElementById("edit-profile-picture");
const profilePictureInput = document.getElementById("profile-picture-input");
const profileImage = document.getElementById("profile-image");

if (editProfilePicture && profilePictureInput && profileImage) {
    editProfilePicture.addEventListener("click", () => {
        profilePictureInput.click();
    });

    profilePictureInput.addEventListener("change", async () => {
        const file = profilePictureInput.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showPopup("Please select an image file.", "error");
            return;
        }

        const patientId = localStorage.getItem("patientId");
        if (!patientId) {
            window.location.href = "../index.html";
            return;
        }

        try {
            const temporaryURL = URL.createObjectURL(file);
            profileImage.src = temporaryURL;

            const imageURL = await uploadToCloudinary(file);

            const patientRef = doc(db, "patients", patientId);
            await updateDoc(patientRef, {
                profilePicture: imageURL
            });

            profileImage.src = imageURL;
            URL.revokeObjectURL(temporaryURL);

            showPopup("Profile picture updated successfully!", "success");

        } catch (error) {
            console.error("Profile picture upload error:", error);
            showPopup("Failed to upload profile picture. Please try again.", "error");
        }

        profilePictureInput.value = "";
    });
}

loadPatientProfile();