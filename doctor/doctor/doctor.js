import { db } from "../../firebase.js";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const hospitalDetails = document.getElementById("hospitalDetails");
const accountSecurity = document.getElementById("accountSecurity");
const gen = document.getElementById("gender");
const arrow = document.getElementById("arrow");
const special = document.getElementById("specialization");
const arrow1 = document.getElementById("arrow1");

hospitalDetails.style.display = "none";
accountSecurity.style.display = "none";

const workingHospital = document.querySelectorAll('input[name="workingHospital"]');

workingHospital.forEach(function (option) {
    option.addEventListener("change", function () {
        if (this.value === "yes") {
            hospitalDetails.style.display = "block";
        } else {
            hospitalDetails.style.display = "none";
        }
        accountSecurity.style.display = "block";
    });
});

gen.addEventListener("focus", () => {
    arrow.style.transform =
        "rotate(180deg) translateX(0.5px) translateY(0.5px) scale(1.2)";
});

gen.addEventListener("blur", () => {
    arrow.style.transform =
        "rotate(0deg) translateX(0.5px) translateY(0.5px) scale(1)";
});
arrow.addEventListener("click", () => {
    gen.focus();
    if (typeof gen.showPicker === "function") gen.showPicker();
});

special.addEventListener("focus", () => {
    arrow1.style.transform =
        "rotate(180deg) translateX(2px) translateY(0.2px) scale(1.2)";
});

special.addEventListener("blur", () => {
    arrow1.style.transform =
        "rotate(0deg) translateX(2px) translateY(0.2px) scale(1)";
});
arrow1.addEventListener("click", () => {
    special.focus();
    if (typeof special.showPicker === "function") special.showPicker();
});

const next = document.getElementById("next");
if (next) {
    next.addEventListener("click", () => {
        window.location.href = "../../index.html";
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

/* ---------------- Doctor Signup ---------------- */

const doctorForm = document.getElementById("doctorForm");

doctorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Get basic details
    const fullName = document.getElementById("fullName").value.trim();
    const dob = document.getElementById("dob").value;
    const gender = document.getElementById("gender").value;
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const address = document.getElementById("address").value.trim();

    // Get professional details
    const specialization = document.getElementById("specialization").value;
    const experience = document.getElementById("experience").value;
    const license = document.getElementById("license").value.trim();

    // Get account details
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;

    // Find whether they selected Yes or No
    const selectedHospital = document.querySelector('input[name="workingHospital"]:checked');

    /* ---------- Validation ---------- */

    if (
        !fullName || !dob || !gender || !phone ||
        !email || !address || !specialization ||
        !experience || !license
    ) {
        showPopup("Please fill in all required fields.", "error");
        return;
    }

    if (!selectedHospital) {
        showPopup("Please select whether you work at a hospital.", "error");
        return;
    }

    if (!password || !confirmPassword) {
        showPopup("Please create and confirm your password.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showPopup("Passwords do not match.", "error");
        return;
    }

    if (!terms) {
        showPopup("Please confirm that your information is correct.", "error");
        return;
    }

    try {
        /* ---------- Check duplicate email ---------- */

        const emailQuery = query(
            collection(db, "doctors"),
            where("email", "==", email)
        );

        const existingDoctors = await getDocs(emailQuery);

        if (!existingDoctors.empty) {
            showPopup("An account with this email already exists.", "error");
            return;
        }

        /* ---------- Create doctor record ---------- */

        // Default doctor profile image based on gender / random pleasant avatar
        const defaultImages = [
            "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400",
            "https://images.unsplash.com/photo-1594824813566-78a08862319d?q=80&w=400",
            "https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=400",
            "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=400",
            "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=400"
        ];
        const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];

        const doctorData = {
            fullName: fullName.startsWith("Dr.") ? fullName : `Dr. ${fullName}`,
            dob,
            gender,
            phone,
            email,
            address,

            specialization,
            experience: Number(experience),
            license,

            workingHospital: selectedHospital.value,
            password,
            profileImageURL: "",
            createdAt: new Date().toISOString()
        };

        /* ---------- Add hospital details ---------- */

        if (selectedHospital.value === "yes") {
            const hName = document.getElementById("hospitalName").value.trim() || "Apollo Hospitals";
            const hLoc = document.getElementById("hospitalLocation").value.trim() || "Hyderabad";
            doctorData.hospital = {
                name: hName,
                location: hLoc,
                department: document.getElementById("department").value.trim(),
                designation: document.getElementById("designation").value.trim(),
                joiningDate: document.getElementById("joiningDate").value,
                employeeId: document.getElementById("employeeId").value.trim()
            };
        } else {
            doctorData.hospital = {
                name: "CareConnect Clinics",
                location: "Main Branch, Hyderabad",
                department: specialization,
                designation: "Consultant"
            };
        }

        /* ---------- Save everything to Firestore ---------- */

        await addDoc(collection(db, "doctors"), doctorData);

        await showPopup("Doctor account created successfully!", "success");

        window.location.href = "../../index.html";

    } catch (error) {
        console.error("Doctor signup error:", error);
        showPopup("Something went wrong during signup. Please try again.", "error");
    }
});
