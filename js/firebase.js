
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqHKyeE3P60LkkXicEkx7mJZN_FhOiNQ8",
  authDomain: "deadline-detective-d8b44.firebaseapp.com",
  projectId: "deadline-detective-d8b44",
  storageBucket: "deadline-detective-d8b44.firebasestorage.app",
  messagingSenderId: "951603180307",
  appId: "1:951603180307:web:a23fce6d93aa85ce7620e6",
  measurementId: "G-KR989WVEEV"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export { app, auth, db };
