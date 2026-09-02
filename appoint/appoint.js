import { db } from "../firebase.js";
import { generateQRCode } from "../qr-helper.js";
import {
    collection,
    onSnapshot,
    deleteDoc,
    updateDoc,
    addDoc,
    getDoc,
    getDocs,
    doc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================================
// 1. AUTH GUARD & SESSION DATA
// ========================================================
const userRole = localStorage.getItem("userRole");
const currentPatientId = localStorage.getItem("patientId");
const currentDoctorId = localStorage.getItem("doctorId");
const currentUserName = localStorage.getItem("userName") || (userRole === "doctor" ? "Doctor" : "Patient");

if (!userRole || (!currentPatientId && !currentDoctorId)) {
    console.warn("Unauthenticated access to appointments. Redirecting to login...");
    window.location.href = "../index.html";
}

// Clean Patient Default Avatar SVG (No random stock photo)
const DEFAULT_PATIENT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23B5DCFF'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%2331568F'/%3E%3Cpath d='M15 90c5-22 20-32 35-32s30 10 35 32' fill='%2331568F'/%3E%3C/svg%3E";

// DOM Elements
const pageMainHeading = document.getElementById("pageMainHeading");
const sectionATitle = document.getElementById("sectionATitle");
const doctorToolbar = document.getElementById("doctorToolbar");
const queueCountVal = document.getElementById("queueCountVal");
const queueWaitVal = document.getElementById("queueWaitVal");
const onDutyToggle = document.getElementById("onDutyToggle");
const onDutyLabel = document.getElementById("onDutyLabel");
const availableFromNote = document.getElementById("availableFromNote");
const slotCapacityInput = document.getElementById("slotCapacityInput");
const appointmentsList = document.getElementById("appointmentsList");
const noAppointmentsMsg = document.getElementById("no-appointments");
const loadingMsg = document.getElementById("loading-appointments");
const sectionBContainer = document.getElementById("sectionBContainer");
const normalAppointmentsList = document.getElementById("normalAppointmentsList");
const noNormalAppointmentsMsg = document.getElementById("no-normal-appointments");

// Details Modal Elements
const detailsOverlay = document.getElementById("detailsOverlay");
const detailsModal = document.getElementById("detailsModal");
const closeModal = document.getElementById("closeModal");
const modalDoctorName = document.getElementById("modalDoctorName");
const modalSpecialityHospital = document.getElementById("modalSpecialityHospital");
const modalDoctor = document.getElementById("modalDoctor");
const modalExperience = document.getElementById("modalExperience");
const modalPatient = document.getElementById("modalPatient");
const modalType = document.getElementById("modalType");
const modalDate = document.getElementById("modalDate");
const modalTime = document.getElementById("modalTime");
const modalHospital = document.getElementById("modalHospital");
const modalLocation = document.getElementById("modalLocation");
const modalNotes = document.getElementById("modalNotes");
const modalWaitTime = document.getElementById("modalWaitTime");

// Offline Patient Modal Elements
const offlineModalOverlay = document.getElementById("offlineModalOverlay");
const openAddOfflineBtn = document.getElementById("openAddOfflineBtn");
const closeOfflineModal = document.getElementById("closeOfflineModal");
const offlinePatientForm = document.getElementById("offlinePatientForm");
const offlinePatientName = document.getElementById("offlinePatientName");
const offlinePatientPhone = document.getElementById("offlinePatientPhone");
const offlineTimeSlot = document.getElementById("offlineTimeSlot");
const offlineNotes = document.getElementById("offlineNotes");
const submitOfflineBtn = document.getElementById("submitOfflineBtn");

// QR Scanner Modal Elements
const scannerOverlay = document.getElementById("scannerOverlay");
const openScanQrBtn = document.getElementById("openScanQrBtn");
const closeScannerBtn = document.getElementById("closeScannerBtn");
const manualApptCode = document.getElementById("manualApptCode");
const verifyManualBtn = document.getElementById("verifyManualBtn");

// Digital Ticket Modal Elements
const ticketOverlay = document.getElementById("ticketOverlay");
const closeTicketModalBtn = document.getElementById("closeTicketModalBtn");
const ticketDoctorName = document.getElementById("ticketDoctorName");
const ticketPatientName = document.getElementById("ticketPatientName");
const ticketDate = document.getElementById("ticketDate");
const ticketTimeSlot = document.getElementById("ticketTimeSlot");
const ticketSpeciality = document.getElementById("ticketSpeciality");
const ticketHospital = document.getElementById("ticketHospital");
const ticketApptId = document.getElementById("ticketApptId");
const ticketQrCode = document.getElementById("ticketQrCode");

let html5QrScanner = null;
let doctorActiveAppointments = []; // Active patient appointments for this doctor
let currentCachedSectionA = [];
let patientProfilesMap = {}; // Real-time mapping of patientId -> actual profilePicture
let allAppointments = [];

// ========================================================
// 2. CONFIGURE VIEW BY ROLE (DOCTOR VS PATIENT)
// ========================================================

const isDoctor = userRole === "doctor";

if (isDoctor) {
    pageMainHeading.textContent = "Doctor Appointments Dashboard";
    sectionATitle.textContent = "Patient Appointments (Live Queue)";
    doctorToolbar.style.display = "flex";
    sectionBContainer.style.display = "block";
} else {
    pageMainHeading.textContent = "Your Appointments";
    sectionATitle.textContent = "Your Booked Appointments";
    doctorToolbar.style.display = "none";
    sectionBContainer.style.display = "none";
}

function isQueueAppointment(appt) {
    return ["booked", "active", "checked-in", "in-consultation"].includes(appt.status);
}

function getSlotCapacity(doctor = {}) {
    const capacity = Number(doctor.slotCapacity);
    return Number.isInteger(capacity) && capacity > 0 ? capacity : 10;
}

async function addAppointmentWithinSlotCapacity(appointmentData) {
    const doctorRef = doc(db, "doctors", appointmentData.doctorId);
    const slotQuery = query(
        collection(db, "appointments"),
        where("doctorId", "==", appointmentData.doctorId),
        where("date", "==", appointmentData.date),
        where("timeSlot", "==", appointmentData.timeSlot)
    );

    // The Web Firestore Transaction API reads documents, not queries. Read the
    // current slot safely, then add only if the doctor's configured limit allows it.
    const [doctorSnap, slotSnap] = await Promise.all([getDoc(doctorRef), getDocs(slotQuery)]);
    const capacity = getSlotCapacity(doctorSnap.exists() ? doctorSnap.data() : {});
    const bookedCount = slotSnap.docs.filter((slotDoc) => isQueueAppointment(slotDoc.data())).length;

    if (bookedCount >= capacity) {
        const error = new Error("This time slot is already full.");
        error.code = "slot-full";
        throw error;
    }

    const appointmentSnap = await addDoc(collection(db, "appointments"), appointmentData);
    return appointmentSnap.id;
}

function appointmentTimeValue(appt) {
    const value = appt.bookedAt || appt.createdAt || "";
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
}

function sameDoctor(first, second) {
    if (first.doctorId && second.doctorId) return first.doctorId === second.doctorId;
    return Boolean(first.doctorName && second.doctorName && first.doctorName === second.doctorName);
}

function getQueueForAppointment(appt) {
    return allAppointments
        .filter((candidate) => candidate.status !== "cancelled" && isQueueAppointment(candidate) && sameDoctor(candidate, appt))
        .sort((a, b) => appointmentTimeValue(a) - appointmentTimeValue(b) || a.id.localeCompare(b.id));
}

function getPatientQueueAhead(appt) {
    if (!isQueueAppointment(appt)) return -1;
    const queue = getQueueForAppointment(appt);
    return queue.findIndex((queueAppt) => queueAppt.id === appt.id);
}

function notifyPatientWhenNext(appt, peopleAhead) {
    const notificationKey = `mediq-next-notification-${appt.id}`;

    if (peopleAhead !== 1) {
        sessionStorage.removeItem(notificationKey);
        return;
    }

    if (sessionStorage.getItem(notificationKey) === "shown") return;
    sessionStorage.setItem(notificationKey, "shown");

    window.showCustomPopup?.({
        title: "You're next",
        message: `Only one patient is ahead of you for your appointment with ${appt.doctorName || "your doctor"}. Please be ready.`,
        type: "info",
        confirmText: "Got it"
    }) || window.showBottomToast?.("You're next — only one patient is ahead of you.");
}

function setDutyControls(doctor = {}) {
    if (!onDutyToggle) return;
    const onDuty = doctor.onDuty === true;
    onDutyToggle.checked = onDuty;
    onDutyLabel.textContent = onDuty ? "On Duty" : "Offline";
    if (availableFromNote && document.activeElement !== availableFromNote) {
        availableFromNote.value = doctor.availableFrom || "";
    }
    if (slotCapacityInput && document.activeElement !== slotCapacityInput) {
        slotCapacityInput.value = String(getSlotCapacity(doctor));
    }
}

async function saveDoctorAvailability(updates) {
    if (!currentDoctorId) return;
    try {
        await updateDoc(doc(db, "doctors", currentDoctorId), updates);
    } catch (err) {
        console.error("Doctor availability update failed:", err);
        window.showCustomPopup?.({
            title: "Could not save availability",
            message: "Please check your connection and try again.",
            type: "error"
        });
    }
}

if (isDoctor && onDutyToggle) {
    onDutyToggle.addEventListener("change", () => {
        onDutyLabel.textContent = onDutyToggle.checked ? "On Duty" : "Offline";
        saveDoctorAvailability({ onDuty: onDutyToggle.checked });
    });
}

if (isDoctor && availableFromNote) {
    availableFromNote.addEventListener("change", () => {
        saveDoctorAvailability({ availableFrom: availableFromNote.value.trim() });
    });
}

if (isDoctor && slotCapacityInput) {
    slotCapacityInput.addEventListener("change", () => {
        const capacity = Math.min(100, Math.max(1, Number(slotCapacityInput.value) || 10));
        slotCapacityInput.value = String(capacity);
        saveDoctorAvailability({ slotCapacity: capacity });
    });
}

if (isDoctor) {
    onSnapshot(doc(db, "doctors", currentDoctorId), (doctorSnap) => {
        if (doctorSnap.exists()) setDutyControls(doctorSnap.data());
    }, (err) => console.error("Doctor availability listener error:", err));
}

// ========================================================
// 3. REAL-TIME APPOINTMENTS & PATIENTS LISTENERS
// ========================================================

// Listen to patients collection in real-time to always show patient's actual profile pic
function initPatientsListener() {
    try {
        onSnapshot(collection(db, "patients"), (snapshot) => {
            const map = {};
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.profilePicture) {
                    map[docSnap.id] = data.profilePicture;
                }
            });
            patientProfilesMap = map;
            if (currentCachedSectionA.length > 0) {
                renderSectionA(currentCachedSectionA, isDoctor);
            }
        });
    } catch (e) {
        console.error("Patients profile listener error:", e);
    }
}

function initRealtimeAppointments() {
    try {
        const apptsRef = collection(db, "appointments");

        onSnapshot(apptsRef, (snapshot) => {
            const allList = [];
            snapshot.forEach((docSnap) => {
                allList.push({ id: docSnap.id, ...docSnap.data() });
            });
            allAppointments = allList;

            if (loadingMsg) loadingMsg.style.display = "none";

            if (isDoctor) {
                // Section A: Appointments booked for THIS doctor (by doctorId or doctorName)
                const docId = currentDoctorId;
                const patientAppointments = allList.filter((appt) => {
                    const isForThisDoc = (appt.doctorId && appt.doctorId === docId) || 
                                         (appt.doctorName && currentUserName && appt.doctorName.toLowerCase().includes(currentUserName.toLowerCase()));
                    return isForThisDoc && appt.status !== "cancelled";
                });

                // The doctor and patient see the same first-come, first-served queue order.
                patientAppointments.sort((a, b) => {
                    const activeDifference = Number(isQueueAppointment(b)) - Number(isQueueAppointment(a));
                    return activeDifference || appointmentTimeValue(a) - appointmentTimeValue(b) || a.id.localeCompare(b.id);
                });

                doctorActiveAppointments = patientAppointments.filter(isQueueAppointment);
                currentCachedSectionA = patientAppointments;

                // Update doctor queue stats
                const queueCount = doctorActiveAppointments.length;
                const estWait = queueCount * 15;
                if (queueCountVal) queueCountVal.textContent = `${queueCount} Patients`;
                if (queueWaitVal) queueWaitVal.textContent = `${estWait} min`;

                renderSectionA(patientAppointments, true);

                // Section B: Normal appointments this doctor booked with OTHER doctors
                const personalAppts = allList.filter((appt) => {
                    return appt.patientId === currentDoctorId && appt.status !== "cancelled";
                });
                renderSectionB(personalAppts);

            } else {
                // Patient view: appointments booked by THIS patient
                const patientAppts = allList.filter((appt) => {
                    return appt.patientId === currentPatientId && appt.status !== "cancelled";
                });

                patientAppts.forEach((appt) => {
                    notifyPatientWhenNext(appt, getPatientQueueAhead(appt));
                });
                currentCachedSectionA = patientAppts;
                renderSectionA(patientAppts, false);
            }
        }, (err) => {
            console.error("Real-time appointments snapshot error:", err);
            if (loadingMsg) loadingMsg.style.display = "none";
            if (window.showBottomToast) {
                window.showBottomToast("Could not sync appointments.", true);
            }
        });
    } catch (e) {
        console.error("Error setting up appointment snapshot listener:", e);
    }
}

// Render Section A (Patient Appointments or My Appointments)
function renderSectionA(appointments, isDoctorView) {
    const existingCards = appointmentsList.querySelectorAll(".doctor-card");
    existingCards.forEach((c) => c.remove());

    if (appointments.length === 0) {
        if (noAppointmentsMsg) {
            noAppointmentsMsg.style.display = "block";
            noAppointmentsMsg.textContent = isDoctorView
                ? "No patient appointments in queue right now."
                : "No appointments booked yet. Book one from Find Doctors page.";
        }
        return;
    }

    if (noAppointmentsMsg) noAppointmentsMsg.style.display = "none";

    let queueIndex = 0;
    appointments.forEach((appt, idx) => {
        const cardQueueIndex = isDoctorView
            ? (isQueueAppointment(appt) ? queueIndex++ : -1)
            : getPatientQueueAhead(appt);
        const card = createAppointmentCard(appt, isDoctorView, cardQueueIndex);
        appointmentsList.appendChild(card);
    });
}

// Render Section B (Doctor's Personal Bookings with Other Doctors)
function renderSectionB(appointments) {
    const existingCards = normalAppointmentsList.querySelectorAll(".doctor-card");
    existingCards.forEach((c) => c.remove());

    if (appointments.length === 0) {
        if (noNormalAppointmentsMsg) noNormalAppointmentsMsg.style.display = "block";
        return;
    }

    if (noNormalAppointmentsMsg) noNormalAppointmentsMsg.style.display = "none";

    appointments.forEach((appt, idx) => {
        const card = createAppointmentCard(appt, false, idx);
        normalAppointmentsList.appendChild(card);
    });
}

// ========================================================
// 4. CREATE APPOINTMENT CARD (WITH WAITING TIME & ACTIONS)
// ========================================================

function createAppointmentCard(appt, isDoctorView, queueIndex = 0) {
    const card = document.createElement("div");
    card.className = "doctor-card";
    card.dataset.appointmentId = appt.id;

    const isOffline = appt.type === "offline";
    const typeLabel = isOffline ? "Walk-in Offline" : "Online Booked";
    const typeClass = isOffline ? "offline" : "online";

    const titleText = isDoctorView
        ? (appt.patientName || "Patient")
        : (appt.doctorName || "Doctor");

    const subtitleText = isDoctorView
        ? (appt.notes ? `Problem: ${appt.notes}` : "General Consultation")
        : (appt.speciality || "General Physician");

    const hospText = appt.hospital || "CareConnect Clinics, Hyderabad";

    // Patient's ACTUAL Profile Picture resolution:
    // 1. Stored appointment patientImage
    // 2. Real-time patient profile picture from patients collection
    // 3. Clean fallback SVG patient icon (Never random stock photos)
    const patientActualImg = appt.patientImage || patientProfilesMap[appt.patientId] || DEFAULT_PATIENT_AVATAR;
    const doctorActualImg = appt.image || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400";

    const imgSrc = isDoctorView ? patientActualImg : doctorActualImg;

    const isCompleted = appt.status === "completed";
    const isNoShow = appt.status === "no-show";
    const waitMins = Math.max(0, queueIndex) * 15;
    const statusLabel = {
        "booked": "Booked",
        "checked-in": "Checked in",
        "in-consultation": "In consultation",
        "completed": "Completed",
        "no-show": "No-show"
    }[appt.status] || "Booked";

    card.innerHTML = `
        <span class="card-type-tag ${typeClass}">${typeLabel}</span>
        
        <div class="doctor-image">
            <img src="${imgSrc}" alt="${escapeHtml(titleText)}" onerror="this.src='${DEFAULT_PATIENT_AVATAR}'">
        </div>

        <div class="doctor-details">
            <h2>${escapeHtml(titleText)}</h2>
            <p class="speciality">${escapeHtml(subtitleText)}</p>
            ${isDoctorView && appt.patientPhone ? `<p class="experience">📞 ${escapeHtml(appt.patientPhone)}</p>` : ""}
            ${!isDoctorView && appt.experience ? `<p class="experience">${escapeHtml(appt.experience)}</p>` : ""}
            
            <div class="appointment-slot-info">
                📅 ${escapeHtml(appt.date || "Today")} · ⏰ ${escapeHtml(appt.timeSlot || appt.time || "Regular")}
            </div>

            ${isDoctorView && queueIndex >= 0 ? `
                <div style="font-size: 12px; color: #0284c7; margin-top: 6px; font-weight: 600;">
                    Queue Position: #${queueIndex + 1} (~${waitMins} min wait)
                </div>
            ` : ""}

            ${!isDoctorView && queueIndex >= 0 ? `
                <div style="font-size: 12px; color: #0284c7; margin-top: 6px; font-weight: 600;">
                    ${queueIndex === 0
                        ? "It is your turn — please check in."
                        : `${queueIndex} person${queueIndex === 1 ? "" : "s"} ahead of you (~${waitMins} min wait)`}
                </div>
            ` : ""}

            <hr>
            <p class="hospital">📍 ${escapeHtml(hospText)}</p>

            ${isDoctorView ? `
                <div style="margin-top: 8px; padding: 4px 10px; background: #eff6ff; color: #1d4ed8; border-radius: 20px; font-size: 12px; font-weight: bold;">
                    ${escapeHtml(statusLabel)}
                </div>
            ` : ""}
        </div>

        <div class="doctor-actions">
            ${isDoctorView ? `
                ${!isCompleted && !isNoShow ? `
                    ${appt.status === "booked" || appt.status === "active" ? `<button class="status-btn" type="button" data-next-status="checked-in">Check In</button>` : ""}
                    ${appt.status === "checked-in" ? `<button class="status-btn" type="button" data-next-status="in-consultation">Start Visit</button>` : ""}
                    ${appt.status === "in-consultation" ? `<button class="complete-btn" type="button" data-next-status="completed">✓ Complete</button>` : ""}
                    <button class="no-show-btn" type="button" data-next-status="no-show">No-show</button>
                ` : ""}
                <button class="check-details-btn" type="button">
                    Details
                </button>
                <button class="cancel-btn" type="button">
                    Cancel
                </button>
            ` : `
                <button class="ticket-btn" type="button">
                    🎫 QR Ticket
                </button>
                <button class="check-details-btn" type="button">
                    Details
                </button>
                <button class="cancel-btn" type="button">
                    Cancel
                </button>
            `}
        </div>
    `;

    // Action button listeners
    const detailsBtn = card.querySelector(".check-details-btn");
    if (detailsBtn) {
        detailsBtn.addEventListener("click", () => openDetails(appt, card, waitMins));
    }

    const cancelBtn = card.querySelector(".cancel-btn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => cancelAppointment(appt, card));
    }

    card.querySelectorAll("[data-next-status]").forEach((statusBtn) => {
        statusBtn.addEventListener("click", () => updateAppointmentStatus(appt, statusBtn.dataset.nextStatus));
    });

    const ticketBtn = card.querySelector(".ticket-btn");
    if (ticketBtn) {
        ticketBtn.addEventListener("click", () => showDigitalTicket(appt));
    }

    return card;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

// ========================================================
// 5. APPOINTMENT ACTIONS (CANCEL / COMPLETE)
// ========================================================

async function cancelAppointment(appt, card) {
    const confirmed = await window.showCustomPopup?.({
        title: "Cancel Appointment",
        message: `Are you sure you want to cancel this appointment for ${appt.patientName || appt.doctorName}?`,
        type: "error",
        confirmText: "Yes, Cancel",
        cancelText: "Keep it"
    }) ?? confirm("Cancel this appointment?");

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "appointments", appt.id));
        if (window.showBottomToast) {
            window.showBottomToast("Appointment cancelled successfully.");
        }
    } catch (err) {
        console.error("Cancel failed:", err);
        window.showCustomPopup?.({
            title: "Error",
            message: "Could not cancel appointment. Please check your connection.",
            type: "error"
        });
    }
}

async function updateAppointmentStatus(appt, status) {
    try {
        const apptRef = doc(db, "appointments", appt.id);
        const timestamps = status === "completed" ? { completedAt: new Date().toISOString() }
            : status === "checked-in" ? { checkedInAt: new Date().toISOString() }
            : status === "in-consultation" ? { consultationStartedAt: new Date().toISOString() }
            : { noShowAt: new Date().toISOString() };
        await updateDoc(apptRef, { status, ...timestamps });

        if (window.showBottomToast) {
            window.showBottomToast(`Appointment marked as ${status.replace("-", " ")}.`);
        }
    } catch (err) {
        console.error("Appointment status update failed:", err);
        window.showCustomPopup?.({
            title: "Error",
            message: "Failed to update appointment status.",
            type: "error"
        });
    }
}

// ========================================================
// 6. APPOINTMENT DETAILS POPUP
// ========================================================

function openDetails(appt, card, estWait = 15) {
    modalDoctorName.textContent = appt.doctorName || "Doctor";
    modalSpecialityHospital.textContent = `${appt.speciality || "Specialist"} • ${(appt.hospital || "CareConnect").split(",")[0]}`;
    modalDoctor.textContent = appt.doctorName || "Doctor";
    modalExperience.textContent = appt.experience || "Specialist";
    modalPatient.textContent = appt.patientName || "Patient";
    modalType.textContent = appt.type === "offline" ? "Walk-in Offline Patient" : "Online Booked Visit";
    modalDate.textContent = appt.date || "Today";
    modalTime.textContent = appt.timeSlot || appt.time || "Regular Slot";
    modalHospital.textContent = (appt.hospital || "CareConnect").split(",")[0];
    modalLocation.textContent = (appt.hospital || "").includes(",") ? appt.hospital.split(",").slice(1).join(",").trim() : "Hyderabad";
    modalNotes.textContent = appt.notes || "No additional notes provided.";
    modalWaitTime.textContent = `${estWait} min`;

    if (card) {
        const cardRect = card.getBoundingClientRect();
        const originX = cardRect.left + cardRect.width / 2;
        const originY = cardRect.top + cardRect.height / 2;
        detailsModal.style.transformOrigin = `${originX}px ${originY}px`;
    }

    detailsOverlay.classList.add("show");
}

if (closeModal) {
    closeModal.addEventListener("click", () => detailsOverlay.classList.remove("show"));
}
if (detailsOverlay) {
    detailsOverlay.addEventListener("click", (e) => {
        if (e.target === detailsOverlay) detailsOverlay.classList.remove("show");
    });
}

// ========================================================
// 7. ADD OFFLINE PATIENT LOGIC (+15 MIN TO LIVE QUEUE)
// ========================================================

if (openAddOfflineBtn) {
    openAddOfflineBtn.addEventListener("click", () => {
        offlinePatientName.value = "";
        offlinePatientPhone.value = "";
        offlineNotes.value = "";
        offlineModalOverlay.classList.add("show");
        setTimeout(() => offlinePatientName.focus(), 100);
    });
}

if (closeOfflineModal) {
    closeOfflineModal.addEventListener("click", () => {
        offlineModalOverlay.classList.remove("show");
    });
}
if (offlineModalOverlay) {
    offlineModalOverlay.addEventListener("click", (e) => {
        if (e.target === offlineModalOverlay) offlineModalOverlay.classList.remove("show");
    });
}

if (offlinePatientForm) {
    offlinePatientForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pName = offlinePatientName.value.trim();
        const pPhone = offlinePatientPhone.value.trim();
        const pSlot = offlineTimeSlot.value;
        const pNotes = offlineNotes.value.trim();

        if (!pName) {
            window.showCustomPopup?.({
                title: "Name Required",
                message: "Please enter the patient's name.",
                type: "error"
            });
            return;
        }

        submitOfflineBtn.disabled = true;
        submitOfflineBtn.textContent = "Adding...";

        try {
            const todayStr = new Date().toISOString().split("T")[0];

            await addAppointmentWithinSlotCapacity({
                doctorId: currentDoctorId,
                doctorName: currentUserName,
                speciality: "Consultation",
                hospital: "CareConnect Clinic",
                patientId: "offline_" + Date.now(),
                patientName: pName,
                patientPhone: pPhone,
                patientImage: DEFAULT_PATIENT_AVATAR,
                date: todayStr,
                timeSlot: pSlot,
                time: pSlot.split("–")[0].trim(),
                notes: pNotes,
                status: "booked",
                type: "offline",
                bookedAt: new Date().toISOString()
            });

            offlineModalOverlay.classList.remove("show");

            if (window.showBottomToast) {
                window.showBottomToast("Offline patient added to queue (+15 min).");
            }

        } catch (err) {
            console.error("Offline add error:", err);
            window.showCustomPopup?.({
                title: err.code === "slot-full" ? "Time Slot Full" : "Error",
                message: err.code === "slot-full"
                    ? "This time slot has reached your patient limit."
                    : "Could not add offline patient.",
                type: "error"
            });
        } finally {
            submitOfflineBtn.disabled = false;
            submitOfflineBtn.textContent = "Add to Live Queue";
        }
    });
}

// ========================================================
// 8. QR CODE SCANNER & TIME VALIDATION LOGIC
// ========================================================

/**
 * Validates whether the QR code is scanned within its allowed appointment time window.
 * Requirement 8: "The QR code should only be valid during the patient's booked appointment time."
 */
function validateAppointmentTimeSlot(appt) {
    if (!appt || !appt.date) {
        return { isValid: false, reason: "Appointment date missing." };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Check Date match (must be today)
    if (appt.date !== todayStr) {
        return {
            isValid: false,
            reason: `This appointment is not currently valid. Scheduled for ${appt.date}, but today is ${todayStr}.`
        };
    }

    // Check Time Slot window if slot format e.g. "09:00 AM – 10:00 AM"
    if (appt.timeSlot && appt.timeSlot.includes("–")) {
        try {
            const [startStr, endStr] = appt.timeSlot.split("–").map(s => s.trim());
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const parseToMinutes = (timeString) => {
                const [time, modifier] = timeString.split(" ");
                let [hours, minutes] = time.split(":").map(Number);
                if (modifier === "PM" && hours < 12) hours += 12;
                if (modifier === "AM" && hours === 12) hours = 0;
                return hours * 60 + (minutes || 0);
            };

            const startMinutes = parseToMinutes(startStr);
            const endMinutes = parseToMinutes(endStr);

            // Allow a 15-minute grace period before slot start and after slot end
            const gracePeriod = 15;
            if (currentMinutes < (startMinutes - gracePeriod) || currentMinutes > (endMinutes + gracePeriod)) {
                return {
                    isValid: false,
                    reason: `This appointment is not currently valid.\nAllowed slot: ${appt.timeSlot}\nCurrent time is outside the allowed period.`
                };
            }
        } catch (e) {
            console.warn("Time slot parsing fallback:", e);
        }
    }

    return { isValid: true };
}

// Process scanned QR payload or ID
async function processScannedAppointment(codeText) {
    const normalizedCode = codeText.trim();
    let apptId = "";
    let scannedData = null;

    // Current appointment tickets intentionally contain only this short ID.
    // Keep JSON support so tickets created before this update can still be read.
    if (normalizedCode.startsWith("CCAPPT:")) {
        apptId = normalizedCode.slice("CCAPPT:".length);
    } else {
        try {
            scannedData = JSON.parse(normalizedCode);
            apptId = scannedData.apptId || scannedData.id;
        } catch (e) {
            apptId = normalizedCode;
        }
    }

    // Find the appointment in doctor's patient list
    const foundAppt = doctorActiveAppointments.find((a) => a.id === apptId || (scannedData && a.patientName === scannedData.patientName && a.date === scannedData.date));

    if (!foundAppt) {
        await window.showCustomPopup?.({
            title: "Verification Failed",
            message: "No active appointment found for this QR code in your clinic queue.",
            type: "error"
        });
        return;
    }

    // QR Code Time Validation (Requirement 8)
    const timeValidation = validateAppointmentTimeSlot(foundAppt);
    if (!timeValidation.isValid) {
        await window.showCustomPopup?.({
            title: "Appointment Not Valid",
            message: timeValidation.reason,
            type: "error"
        });
        return;
    }

    // A valid QR scan checks the patient in immediately.
    await updateAppointmentStatus(foundAppt, "checked-in");
}

if (openScanQrBtn) {
    openScanQrBtn.addEventListener("click", () => {
        scannerOverlay.classList.add("show");
        startQrCamera();
    });
}

function startQrCamera() {
    if (typeof Html5Qrcode !== "undefined") {
        html5QrScanner = new Html5Qrcode("qr-reader");
        html5QrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 200 },
            async (decodedText) => {
                stopQrCamera();
                scannerOverlay.classList.remove("show");
                await processScannedAppointment(decodedText);
            },
            (error) => {
                // frame decode failed, normal behavior during scanning
            }
        ).catch((err) => {
            console.warn("Camera access failed:", err);
            const qrReaderDiv = document.getElementById("qr-reader");
            if (qrReaderDiv) {
                qrReaderDiv.innerHTML = `
                    <div style="padding: 20px; color: white; font-size: 12px; text-align: center;">
                        <p>Camera not accessible or permission denied.</p>
                        <p style="color: #93c5fd; margin-top: 8px;">Please enter the Appointment ID below to verify.</p>
                    </div>
                `;
            }
        });
    }
}

function stopQrCamera() {
    if (html5QrScanner) {
        html5QrScanner.stop().catch(() => {}).finally(() => {
            html5QrScanner = null;
        });
    }
}

if (closeScannerBtn) {
    closeScannerBtn.addEventListener("click", () => {
        stopQrCamera();
        scannerOverlay.classList.remove("show");
    });
}
if (scannerOverlay) {
    scannerOverlay.addEventListener("click", (e) => {
        if (e.target === scannerOverlay) {
            stopQrCamera();
            scannerOverlay.classList.remove("show");
        }
    });
}

if (verifyManualBtn) {
    verifyManualBtn.addEventListener("click", async () => {
        const code = manualApptCode.value.trim();
        if (!code) return;
        stopQrCamera();
        scannerOverlay.classList.remove("show");
        await processScannedAppointment(code);
        manualApptCode.value = "";
    });
}

// ========================================================
// 9. DIGITAL TICKET QR PASS MODAL (FOR PATIENTS)
// ========================================================

function showDigitalTicket(appt) {
    ticketDoctorName.textContent = appt.doctorName || "Doctor";
    ticketPatientName.textContent = appt.patientName || "Patient";
    ticketDate.textContent = appt.date || "Today";
    ticketTimeSlot.textContent = appt.timeSlot || appt.time || "Scheduled Slot";
    ticketSpeciality.textContent = appt.speciality || "General";
    ticketHospital.textContent = (appt.hospital || "CareConnect").split(",")[0];
    ticketApptId.textContent = appt.id || "CC-APPT-PASS";

    // A short payload makes the QR sparse enough to scan reliably. The doctor
    // page uses this ID to fetch and validate the appointment in Firebase.
    generateQRCode(ticketQrCode, `CCAPPT:${appt.id}`, 220);

    ticketOverlay.classList.add("show");
}

if (closeTicketModalBtn) {
    closeTicketModalBtn.addEventListener("click", () => {
        ticketOverlay.classList.remove("show");
    });
}
if (ticketOverlay) {
    ticketOverlay.addEventListener("click", (e) => {
        if (e.target === ticketOverlay) ticketOverlay.classList.remove("show");
    });
}

// Start Real-time synchronization
initPatientsListener();
initRealtimeAppointments();
