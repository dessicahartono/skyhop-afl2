import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIsJVYINWxl3tSnUnl31JmB0k_LLzz7-M",
  authDomain: "skyhop-project.firebaseapp.com",
  databaseURL: "https://skyhop-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "skyhop-project",
  storageBucket: "skyhop-project.firebasestorage.app",
  messagingSenderId: "921449354346",
  appId: "1:921449354346:web:e418f868f0d4de07286613",
  measurementId: "G-NRXV07FLV3"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
