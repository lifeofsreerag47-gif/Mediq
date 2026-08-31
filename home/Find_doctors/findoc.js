import { db } from "../../firebase.js";
import { generateQRCode } from "../../qr-helper.js";
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    getDoc,
    query
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================================
// 1. AUTH GUARD
// ========================================================
const userRole = localStorage.getItem("userRole");
const currentPatientId = localStorage.getItem("patientId");
const currentDoctorId = localStorage.getItem("doctorId");
const currentUserName = localStorage.getItem("userName") || "Patient";

if (!userRole || (!currentPatientId && !currentDoctorId)) {
    console.warn("Unauthenticated user accessing find doctors. Redirecting...");
    window.location.href = "../../index.html";
}

// ========================================================
// 2. BASELINE SEED DOCTORS
// ========================================================
const baselineDoctors = [
    {
        id: "seed_doc_1",
        fullName: "Dr. Aniket S Phutane",
        specialization: "Neurology",
        experience: 7,
        hospital: { name: "Apollo Hospitals", location: "Jubilee Hills, Hyderabad" },
        profileImageURL: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400",
        phone: "+91 9876543210"
    },
    {
        id: "seed_doc_2",
        fullName: "Dr. Rajesh V. Reddy",
        specialization: "Cardiology",
        experience: 14,
        hospital: { name: "Yashoda Hospitals", location: "Somajiguda, Hyderabad" },
        profileImageURL: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=400",
        phone: "+91 9876543211"
    },
    {
        id: "seed_doc_3",
        fullName: "Dr. Sneha Kulkarni",
        specialization: "Dermatology",
        experience: 9,
        hospital: { name: "KIMS Hospitals", location: "Secunderabad, Hyderabad" },
        profileImageURL: "https://plus.unsplash.com/premium_photo-1682089874677-3eee554feb19?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        phone: "+91 9876543212"
    },
    {
        id: "seed_doc_4",
        fullName: "Dr. Vikramaditya Rao",
        specialization: "Orthopedics",
        experience: 12,
        hospital: { name: "CARE Hospitals", location: "Gachibowli, Hyderabad" },
        profileImageURL: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=400",
        phone: "+91 9876543213"
    },
    {
        id: "seed_doc_5",
        fullName: "Dr. Priya Sundaram",
        specialization: "Pediatrics",
        experience: 8,
        hospital: { name: "Rainbow Children's Hospital", location: "Banjara Hills, Hyderabad" },
        profileImageURL: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=400",
        phone: "+91 9876543214"
    },
    {
        id: "seed_doc_6",
        fullName: "Dr. Arvind Sharma",
        specialization: "Ophthalmology",
        experience: 10,
        hospital: { name: "L V Prasad Eye Institute", location: "Banjara Hills, Hyderabad" },
        profileImageURL: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400",
        phone: "+91 9876543215"
    },
    {
        id: "seed_doc_7",
        fullName: "Dr. Shalini Varrma",
        specialization: "Dentistry",
        experience: 6,
        hospital: { name: "Continental Hospitals", location: "Financial District, Hyderabad" },
        profileImageURL: "https://media.istockphoto.com/id/1301595548/photo/female-doctor-stock-photo.webp?a=1&b=1&s=612x612&w=0&k=20&c=PW3Lbgi6F8DjYdKffpo6Uyo07ZBxw69utLcASzxX3b0=",
        phone: "+91 9876543216"
    }
];

// ========================================================
// 3. STATE & DOM ELEMENTS
// ========================================================
let allDoctors = [];
let doctorQueueCounts = {}; // doctorId -> count of active/booked appointments

const doctorCardsContainer = document.getElementById("doctorCardsContainer");
const totalDoctorsCount = document.getElementById("totalDoctorsCount");
const searchInput = document.getElementById("doctorSearch");
const searchBtn = document.getElementById("searchBtn");
const clearFiltersBtn = document.getElementById("clearFilters");
const filterCheckboxes = document.querySelectorAll(".filter-spec");

// Booking Modal Elements
const bookingOverlay = document.getElementById("bookingOverlay");
const closeBookingModal = document.getElementById("closeBookingModal");
const bookDocName = document.getElementById("bookDocName");
const bookDocMeta = document.getElementById("bookDocMeta");
const appointmentDate = document.getElementById("appointmentDate");
const slotsGrid = document.getElementById("slotsGrid");
const appointmentNotes = document.getElementById("appointmentNotes");
const wordCount = document.getElementById("wordCount");
const wordCountHint = document.getElementById("wordCountHint");
const confirmBookingBtn = document.getElementById("confirmBookingBtn");

// Ticket Modal Elements
const ticketOverlay = document.getElementById("ticketOverlay");
const closeTicketBtn = document.getElementById("closeTicketBtn");
const viewAppointmentsBtn = document.getElementById("viewAppointmentsBtn");
const ticketDoctorName = document.getElementById("ticketDoctorName");
const ticketPatientName = document.getElementById("ticketPatientName");
const ticketDate = document.getElementById("ticketDate");
const ticketTimeSlot = document.getElementById("ticketTimeSlot");
const ticketSpeciality = document.getElementById("ticketSpeciality");
const ticketHospital = document.getElementById("ticketHospital");
const ticketApptId = document.getElementById("ticketApptId");
const ticketQrCode = document.getElementById("ticketQrCode");

let selectedDoctorForBooking = null;
let selectedTimeSlot = "";

// ========================================================
// 4. REAL-TIME SYNCHRONIZATION (DOCTORS & QUEUES)
// ========================================================

// Listen to Firestore `appointments` to compute dynamic waiting times
function initAppointmentsListener() {
    try {
        const q = query(collection(db, "appointments"));
        onSnapshot(q, (snapshot) => {
            const counts = {};
            snapshot.forEach((docSnap) => {
                const appt = docSnap.data();
                // Count appointments that are still in the live queue.
                if (["booked", "active", "checked-in", "in-consultation"].includes(appt.status)) {
                    const docKey = appt.doctorId || appt.doctorName;
                    if (docKey) {
                        counts[docKey] = (counts[docKey] || 0) + 1;
                    }
                    if (appt.doctorName) {
                        counts[appt.doctorName] = (counts[appt.doctorName] || 0) + 1;
                    }
                }
            });
            doctorQueueCounts = counts;
            renderDoctors();
        }, (err) => {
            console.error("Appointments queue listener error:", err);
        });
    } catch (e) {
        console.error("Error setting appointments listener:", e);
    }
}

// Listen to Firestore `doctors` in real-time
function initDoctorsListener() {
    try {
        onSnapshot(collection(db, "doctors"), (snapshot) => {
            const firestoreDoctors = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                firestoreDoctors.push({
                    id: docSnap.id,
                    ...data
                });
            });

            // Merge baseline doctors with newly registered firestore doctors (avoiding duplicate emails/IDs)
            const combined = [...firestoreDoctors];
            baselineDoctors.forEach((baseDoc) => {
                const exists = firestoreDoctors.some(
                    (fd) => (fd.email && fd.email === baseDoc.email) || fd.fullName === baseDoc.fullName
                );
                if (!exists) {
                    combined.push(baseDoc);
                }
            });

            // Rule: If current logged-in user is a Doctor, do NOT show their own card
            allDoctors = combined.filter((doc) => {
                if (userRole === "doctor" && currentDoctorId && doc.id === currentDoctorId) {
                    return false;
                }
                return true;
            });

            renderDoctors();
        }, (err) => {
            console.error("Doctors listener error:", err);
            // Fallback to baseline
            allDoctors = [...baselineDoctors].filter(doc => !(userRole === "doctor" && currentDoctorId && doc.id === currentDoctorId));
            renderDoctors();
        });
    } catch (e) {
        console.error("Failed to initialize doctors listener:", e);
        allDoctors = [...baselineDoctors];
        renderDoctors();
    }
}

// ========================================================
// 5. FILTERING & RENDERING LOGIC
// ========================================================

function normalizeSpecialty(spec) {
    if (!spec) return "";
    const s = spec.toLowerCase();
    if (s.includes("cardio")) return "cardiology";
    if (s.includes("derma")) return "dermatology";
    if (s.includes("neuro")) return "neurology";
    if (s.includes("dent")) return "dentistry";
    if (s.includes("physician") || s.includes("general")) return "general physician";
    if (s.includes("ortho")) return "orthopedics";
    if (s.includes("ophthal") || s.includes("eye")) return "ophthalmology";
    if (s.includes("pedia")) return "pediatrics";
    if (s.includes("psych")) return "psychiatry";
    return s;
}

function getSelectedSpecialties() {
    const selected = [];
    filterCheckboxes.forEach((cb) => {
        if (cb.checked) selected.push(normalizeSpecialty(cb.value));
    });
    return selected;
}

function renderDoctors() {
    const selectedSpecs = getSelectedSpecialties();
    const searchQuery = (searchInput.value || "").trim().toLowerCase();

    const filtered = allDoctors.filter((doc) => {
        // Specialization filter
        if (selectedSpecs.length > 0) {
            const docSpecNorm = normalizeSpecialty(doc.specialization);
            const matchesSpec = selectedSpecs.some(
                (spec) => docSpecNorm.includes(spec) || spec.includes(docSpecNorm)
            );
            if (!matchesSpec) return false;
        }

        // Search query filter (matches name, speciality, hospital name/location)
        if (searchQuery) {
            const name = (doc.fullName || "").toLowerCase();
            const spec = (doc.specialization || "").toLowerCase();
            const hospName = typeof doc.hospital === "object"
                ? `${doc.hospital?.name || ""} ${doc.hospital?.location || ""}`.toLowerCase()
                : String(doc.hospital || "").toLowerCase();

            const matchesSearch =
                name.includes(searchQuery) ||
                spec.includes(searchQuery) ||
                hospName.includes(searchQuery);

            if (!matchesSearch) return false;
        }

        return true;
    });

    totalDoctorsCount.textContent = String(filtered.length).padStart(3, "0");

    if (filtered.length === 0) {
        doctorCardsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: #64748b;">
                <h3 style="font-size: 20px; color: #1d3557; margin-bottom: 8px;">No doctors found</h3>
                <p>Try adjusting your search query or unchecking filter options.</p>
            </div>
        `;
        return;
    }

    doctorCardsContainer.innerHTML = "";
    filtered.forEach((doc) => {
        const card = createDoctorCard(doc);
        doctorCardsContainer.appendChild(card);
    });
}

function createDoctorCard(doc) {
    const card = document.createElement("div");
    card.className = "doctor-card";
    card.dataset.doctorId = doc.id;

    const hospStr = typeof doc.hospital === "object"
        ? `${doc.hospital?.name || "CareConnect Hospital"}${doc.hospital?.location ? ", " + doc.hospital.location : ""}`
        : (doc.hospital || "CareConnect Hospital, Hyderabad");

    const imgSrc = doc.profileImageURL || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400";

    // Dynamic Waiting Time Calculation: 15 mins per patient ahead
    const queueCount = doctorQueueCounts[doc.id] || doctorQueueCounts[doc.fullName] || 0;
    const isOnDuty = doc.onDuty === true;
    const availableFrom = (doc.availableFrom || "").trim();
    const estWaitMins = queueCount * 15;
    const waitBadgeClass = queueCount > 1 ? "card-wait-badge busy" : "card-wait-badge";
    const availabilityText = isOnDuty
        ? "Available now"
        : `Offline / Not available${availableFrom ? ` · ${escapeHtml(availableFrom)}` : ""}`;
    const waitText = queueCount === 0
        ? `⏱️ Est. Wait: 0 min (${availabilityText})`
        : `⏱️ Est. Wait: ~${estWaitMins} min (${queueCount} in queue) · ${availabilityText}`;

    card.innerHTML = `
        <div class="doctor-image">
            <img src="${imgSrc}" alt="${escapeHtml(doc.fullName || "Doctor")}">
        </div>

        <div class="doctor-details">
            <h2>${escapeHtml(doc.fullName || "Doctor")}</h2>
            <p class="speciality">${escapeHtml(doc.specialization || "General Physician")}</p>
            <p class="experience">${doc.experience ? doc.experience + "+ Years Experience" : "Experienced Specialist"}</p>
            <div class="doctor-availability ${isOnDuty ? "on-duty" : "offline"}">
                ${isOnDuty ? "● On Duty" : `● Offline / Not available${availableFrom ? ` · ${escapeHtml(availableFrom)}` : ""}`}
            </div>
            
            <div class="${waitBadgeClass}">
                ${waitText}
            </div>

            <hr>

            <p class="hospital">📍 ${escapeHtml(hospStr)}</p>
        </div>

        <div class="doctor-actions">
            <button class="book-btn" type="button">
                Book Appointment
            </button>
            <button class="call-btn" type="button">
                📞 Call Now
            </button>
        </div>
    `;

    card.querySelector(".book-btn").addEventListener("click", () => {
        openBookingModal(doc);
    });

    card.querySelector(".call-btn").addEventListener("click", () => {
        const phone = doc.phone || "+91 9849979264";
        if (window.showCustomPopup) {
            window.showCustomPopup({
                title: doc.fullName,
                message: `Direct Clinic Helpline: ${phone}\nAvailable Mon - Sat (9:00 AM - 6:00 PM)`,
                type: "info"
            });
        } else {
            alert(`Helpline: ${phone}`);
        }
    });

    return card;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

// ========================================================
// 6. FILTER & SEARCH EVENT LISTENERS
// ========================================================

filterCheckboxes.forEach((cb) => {
    cb.addEventListener("change", renderDoctors);
});

searchInput.addEventListener("input", renderDoctors);
if (searchBtn) {
    searchBtn.addEventListener("click", renderDoctors);
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
        filterCheckboxes.forEach((cb) => (cb.checked = false));
        searchInput.value = "";
        renderDoctors();
    });
}

// ========================================================
// 7. APPOINTMENT BOOKING MODAL LOGIC (1-WEEK DATES & 50-WORD NOTES)
// ========================================================

function openBookingModal(doc) {
    selectedDoctorForBooking = doc;
    selectedTimeSlot = "";

    bookDocName.textContent = `Book with ${doc.fullName}`;
    const hospStr = typeof doc.hospital === "object"
        ? `${doc.hospital?.name || "CareConnect Hospital"}`
        : (doc.hospital || "CareConnect Hospital");
    bookDocMeta.textContent = `${doc.specialization} • ${hospStr}`;

    // Date Restriction: Upcoming week only (Today to Today + 7 days)
    const today = new Date();
    const minDateStr = today.toISOString().split("T")[0];

    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 7);
    const maxDateStr = maxDate.toISOString().split("T")[0];

    appointmentDate.min = minDateStr;
    appointmentDate.max = maxDateStr;
    appointmentDate.value = minDateStr;

    // Reset time slots
    slotsGrid.querySelectorAll(".slot-btn").forEach((btn) => {
        btn.classList.remove("selected");
    });

    // Reset notes and word counter
    appointmentNotes.value = "";
    updateWordCount();

    bookingOverlay.classList.add("show");
}

function closeBooking() {
    bookingOverlay.classList.remove("show");
    selectedDoctorForBooking = null;
    selectedTimeSlot = "";
}

closeBookingModal.addEventListener("click", closeBooking);
bookingOverlay.addEventListener("click", (e) => {
    if (e.target === bookingOverlay) closeBooking();
});

// Time Slot Button Selection
slotsGrid.addEventListener("click", (e) => {
    const slotBtn = e.target.closest(".slot-btn");
    if (!slotBtn) return;

    slotsGrid.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("selected"));
    slotBtn.classList.add("selected");
    selectedTimeSlot = slotBtn.dataset.slot;
});

// Word Count Limiter (Max 50 words)
function updateWordCount() {
    const text = appointmentNotes.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean) : [];
    const count = words.length;

    wordCount.textContent = `${count} / 50 words`;

    if (count > 50) {
        wordCountHint.classList.add("limit-exceeded");
        // Auto trim to 50 words
        const trimmed = words.slice(0, 50).join(" ");
        appointmentNotes.value = trimmed;
        wordCount.textContent = `50 / 50 words (Max reached)`;
    } else {
        wordCountHint.classList.remove("limit-exceeded");
    }
}

appointmentNotes.addEventListener("input", updateWordCount);

// Confirm Booking Submission
confirmBookingBtn.addEventListener("click", async () => {
    if (!selectedDoctorForBooking) return;

    const dateVal = appointmentDate.value;
    if (!dateVal) {
        window.showCustomPopup?.({
            title: "Date Required",
            message: "Please select an appointment date within the upcoming week.",
            type: "error"
        }) || alert("Please select an appointment date.");
        return;
    }

    if (!selectedTimeSlot) {
        window.showCustomPopup?.({
            title: "Time Slot Required",
            message: "Please select one of the available time slot buttons.",
            type: "error"
        }) || alert("Please select a time slot.");
        return;
    }

    confirmBookingBtn.disabled = true;
    confirmBookingBtn.textContent = "Booking...";

    try {
        const hospName = typeof selectedDoctorForBooking.hospital === "object"
            ? `${selectedDoctorForBooking.hospital?.name || "CareConnect Hospital"}, ${selectedDoctorForBooking.hospital?.location || "Hyderabad"}`
            : (selectedDoctorForBooking.hospital || "CareConnect Hospital, Hyderabad");

        const patientId = currentPatientId || currentDoctorId;
        const patientName = currentUserName || "Patient";

        const apptData = {
            doctorId: selectedDoctorForBooking.id,
            doctorName: selectedDoctorForBooking.fullName,
            speciality: selectedDoctorForBooking.specialization || "General Physician",
            experience: selectedDoctorForBooking.experience ? `${selectedDoctorForBooking.experience}+ Years` : "Specialist",
            hospital: hospName,
            image: selectedDoctorForBooking.profileImageURL || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400",
            patientId,
            patientName,
            date: dateVal,
            time: selectedTimeSlot.split("–")[0].trim(),
            timeSlot: selectedTimeSlot,
            notes: appointmentNotes.value.trim(),
            status: "booked",
            type: "online",
            bookedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "appointments"), apptData);
        apptData.id = docRef.id;

        // Close Booking Modal
        closeBooking();

        // Show standard bottom toast (Requirement 4: "Appointment Booked.")
        if (window.showBottomToast) {
            window.showBottomToast("Appointment Booked.");
        }

        // Show Digital Ticket Popup with QR Code (Requirement 8)
        showDigitalTicket(apptData);

    } catch (err) {
        console.error("Booking error:", err);
        window.showCustomPopup?.({
            title: "Booking Failed",
            message: "Could not complete your booking. Please try again.",
            type: "error"
        }) || alert("Could not complete booking.");
    } finally {
        confirmBookingBtn.disabled = false;
        confirmBookingBtn.textContent = "Confirm Appointment";
    }
});

// ========================================================
// 8. QR CODE DIGITAL TICKET MODAL (MOVIE TICKET STYLE)
// ========================================================

function showDigitalTicket(appt) {
    ticketDoctorName.textContent = appt.doctorName || "Doctor";
    ticketPatientName.textContent = appt.patientName || "Patient";
    ticketDate.textContent = appt.date || "Today";
    ticketTimeSlot.textContent = appt.timeSlot || appt.time || "Scheduled Slot";
    ticketSpeciality.textContent = appt.speciality || "General";
    ticketHospital.textContent = (appt.hospital || "CareConnect Hospital").split(",")[0];
    ticketApptId.textContent = appt.id || "CC-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Store only the appointment ID in the QR. This keeps the pattern simple
    // for dependable scanning and avoids exposing patient details in the code.
    generateQRCode(ticketQrCode, `CCAPPT:${appt.id}`, 220);

    ticketOverlay.classList.add("show");
}

if (closeTicketBtn) {
    closeTicketBtn.addEventListener("click", () => {
        ticketOverlay.classList.remove("show");
    });
}
if (viewAppointmentsBtn) {
    viewAppointmentsBtn.addEventListener("click", () => {
        window.location.href = "../../appoint/appoint.html";
    });
}
if (ticketOverlay) {
    ticketOverlay.addEventListener("click", (e) => {
        if (e.target === ticketOverlay) {
            ticketOverlay.classList.remove("show");
        }
    });
}

// Initialize Real-time Data
initAppointmentsListener();
initDoctorsListener();
