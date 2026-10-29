
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const avatarIds = [
  "sidebarAvatar",
  "topbarAvatar",
  "navProfileAvatar"
];

let unsubscribeProfile = null;

function updateAvatar(name, photoData = "") {
  const initial = (name || "Student").charAt(0).toUpperCase();

  for (const id of avatarIds) {
    const element = document.getElementById(id);

    if (!element) continue;

    element.textContent = photoData ? "" : initial;

    element.style.backgroundImage = photoData
      ? `url("${photoData}")`
      : "none";

    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.style.backgroundRepeat = "no-repeat";
  }

  const sidebarName = document.getElementById("sidebarName");
  const studentName = document.getElementById("studentName");

  if (sidebarName) {
    sidebarName.textContent = name;
  }

  if (studentName) {
    studentName.textContent = name;
  }
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeProfile) {
    unsubscribeProfile();
    unsubscribeProfile = null;
  }

  if (!user) {
    updateAvatar("Student", "");
    return;
  }

  const fallbackName = user.displayName || "Student";

  updateAvatar(fallbackName, "");

  unsubscribeProfile = onSnapshot(
    doc(db, "users", user.uid),
    (snapshot) => {
      if (auth.currentUser?.uid !== user.uid) return;

      const data = snapshot.exists() ? snapshot.data() : {};

      const name = data.name || fallbackName;
      const photoData = data.photoData || "";

      updateAvatar(name, photoData);
    },
    (error) => {
      console.error("Profile avatar loading failed:", error);
    }
  );
});
