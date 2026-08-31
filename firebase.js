// Import Firebase functions from Firebase's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWjwDFmeeZt0Z2WdewKxlDtrN-foxSBQk",
    authDomain: "doctorcare-ceaeb.firebaseapp.com",
    projectId: "doctorcare-ceaeb",
    storageBucket: "doctorcare-ceaeb.firebasestorage.app",
    messagingSenderId: "906560451934",
    appId: "1:906560451934:web:a9f8451fcf78d99180cbcf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Connect to Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// Make the database available to other files
export { db, storage };