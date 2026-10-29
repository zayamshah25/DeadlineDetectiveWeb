
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendEmailVerification,
  reload
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let profileBusy = false;
let passwordBusy = false;
let verificationBusy = false;
let profileLoadVersion = 0;

function showMessage(message, type = "error") {
  $("profileMessage").textContent = message;
  $("profileMessage").className = `profile-message ${type}`;
}

function getFriendlyError(error) {
  const messages = {
    "auth/wrong-password": "The current password is incorrect.",
    "auth/invalid-credential": "The current password is incorrect.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/requires-recent-login": "Please log out and sign in again before trying.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network connection failed. Try again.",
    "auth/user-token-expired": "Your session has expired. Please sign in again.",
    "permission-denied": "Firestore permission denied. Check your security rules.",
    "unavailable": "Firebase is temporarily unavailable. Try again."
  };

  return messages[error.code] || error.message || "Something went wrong.";
}

function setButtonBusy(button, busy, loadingText, normalText) {
  button.disabled = busy;
  button.textContent = busy ? loadingText : normalText;
}

function renderUser(user, name) {
  const displayName = name || user.displayName || "Student";
  const initial = displayName.charAt(0).toUpperCase();

  $("studentName").textContent = displayName;
  $("studentEmail").textContent = user.email || "";
  $("profileName").value = displayName;
  $("profileEmail").value = user.email || "";

  $("profileAvatar").textContent = initial;
  $("sidebarAvatar").textContent = initial;
  $("topbarAvatar").textContent = initial;
  $("sidebarName").textContent = displayName;

  renderVerification(user);
}

function renderVerification(user) {
  const verified = user.emailVerified;

  $("verificationStatus").textContent =
    verified ? "Verified" : "Not Verified";

  $("accountStatus").textContent =
    verified ? "✓ Verified Account" : "Email Verification Pending";

  $("verificationDescription").textContent = verified
    ? "Your email address has been verified successfully."
    : "Send a verification link to your registered email address.";

  $("verifyEmailButton").disabled = verified || verificationBusy;
  $("verifyEmailButton").textContent = verified
    ? "Email Verified"
    : "Send Verification Email";
}

function formatCreatedAt(timestamp, fallback) {
  const date = timestamp?.toDate?.() || fallback;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

async function loadProfile(user) {
  const version = ++profileLoadVersion;

  try {
    const snapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (version !== profileLoadVersion || auth.currentUser?.uid !== user.uid) {
      return;
    }

    const profileData = snapshot.exists() ? snapshot.data() : {};
    const displayName = profileData.name || user.displayName || "Student";

    renderUser(user, displayName);

    $("memberSince").textContent = formatCreatedAt(
      profileData.createdAt,
      user.metadata.creationTime
        ? new Date(user.metadata.creationTime)
        : null
    );

    showMessage("");
  } catch (error) {
    console.error("Profile loading failed:", error);

    if (version !== profileLoadVersion) return;

    renderUser(user, user.displayName);
    $("memberSince").textContent = formatCreatedAt(
      null,
      user.metadata.creationTime
        ? new Date(user.metadata.creationTime)
        : null
    );

    showMessage(getFriendlyError(error));
  }
}

async function saveProfile(event) {
  event.preventDefault();

  if (!currentUser || profileBusy) return;

  const user = currentUser;
  const name = $("profileName").value.trim();

  if (name.length < 2 || name.length > 80) {
    showMessage("Your name must be between 2 and 80 characters.");
    return;
  }

  const button = $("saveProfileButton");
  profileBusy = true;
  setButtonBusy(button, true, "Saving...", "Save Profile Changes");

  try {
    await updateDoc(doc(db, "users", user.uid), {
      name,
      updatedAt: serverTimestamp()
    });

    try {
      await updateProfile(user, { displayName: name });
      renderUser(user, name);
      showMessage("Profile updated successfully!", "success");
    } catch (authError) {
      console.error("Firebase Auth profile update failed:", authError);
      renderUser(user, name);
      showMessage(
        "Your name was saved in Firestore, but the sign-in profile could not be updated. Please try saving again."
      );
    }
  } catch (error) {
    console.error("Profile update failed:", error);
    showMessage(getFriendlyError(error));
  } finally {
    profileBusy = false;
    setButtonBusy(button, false, "Saving...", "Save Profile Changes");
  }
}

function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: "Enter a new password." };

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: "Weak password" };
  if (score === 3) return { score: 2, label: "Fair password" };
  if (score === 4) return { score: 3, label: "Good password" };

  return { score: 4, label: "Strong password" };
}

function updateStrengthIndicator() {
  const result = calculatePasswordStrength($("newPassword").value);
  const bar = $("passwordStrengthBar");

  const colors = ["#fb7185", "#fb7185", "#fbbf24", "#22d3ee", "#34d399"];
  const widths = ["0%", "25%", "50%", "75%", "100%"];

  bar.style.width = widths[result.score];
  bar.style.backgroundColor = colors[result.score];

  $("passwordStrengthText").textContent = result.label;
}

async function changePassword(event) {
  event.preventDefault();

  if (!currentUser || passwordBusy) return;

  const user = currentUser;
  const currentPassword = $("currentPassword").value;
  const newPassword = $("newPassword").value;
  const confirmPassword = $("confirmPassword").value;

  if (newPassword.length < 8) {
    showMessage("Your new password must contain at least 8 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("New password and confirmation do not match.");
    return;
  }

  if (currentPassword === newPassword) {
    showMessage("Your new password must differ from your current password.");
    return;
  }

  if (!user.email) {
    showMessage("This account does not have a password-based email address.");
    return;
  }

  const button = $("changePasswordButton");
  passwordBusy = true;
  setButtonBusy(button, true, "Updating...", "Update Password Securely");

  try {
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    $("passwordForm").reset();
    updateStrengthIndicator();

    showMessage(
      "Password changed successfully! Use your new password next time you sign in.",
      "success"
    );
  } catch (error) {
    console.error("Password update failed:", error);
    showMessage(getFriendlyError(error));
  } finally {
    passwordBusy = false;
    setButtonBusy(
      button,
      false,
      "Updating...",
      "Update Password Securely"
    );
  }
}

async function sendVerification() {
  if (!currentUser || verificationBusy || currentUser.emailVerified) return;

  const button = $("verifyEmailButton");
  verificationBusy = true;
  button.disabled = true;
  button.textContent = "Sending...";

  try {
    await sendEmailVerification(currentUser);
    showMessage(
      "Verification email sent! Check your inbox and spam folder.",
      "success"
    );
  } catch (error) {
    console.error("Email verification failed:", error);
    showMessage(getFriendlyError(error));
  } finally {
    verificationBusy = false;

    if (currentUser) renderVerification(currentUser);
  }
}

async function refreshVerification() {
  if (!currentUser || verificationBusy) return;

  const button = $("refreshVerificationButton");
  button.disabled = true;
  button.textContent = "Refreshing...";

  try {
    await reload(currentUser);
    renderVerification(currentUser);

    showMessage(
      currentUser.emailVerified
        ? "Your email is verified!"
        : "Your email is not verified yet. Open the verification link first.",
      currentUser.emailVerified ? "success" : "error"
    );
  } catch (error) {
    console.error("Verification refresh failed:", error);
    showMessage(getFriendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "Refresh Verification Status";
  }
}

document.querySelectorAll("[data-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.toggle);
    const visible = input.type === "password";

    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
    button.setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password"
    );
  });
});

$("newPassword").addEventListener("input", updateStrengthIndicator);
$("profileForm").addEventListener("submit", saveProfile);
$("passwordForm").addEventListener("submit", changePassword);

$("verifyEmailButton").addEventListener("click", sendVerification);
$("refreshVerificationButton").addEventListener("click", refreshVerification);

$("menuToggle").addEventListener("click", () => {
  const isOpen = $("sidebar").classList.toggle("open");
  $("menuToggle").setAttribute("aria-expanded", String(isOpen));
});

$("footerYear").textContent = new Date().getFullYear();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    profileLoadVersion++;
    currentUser = null;
    $("profileForm").reset();
    $("passwordForm").reset();
    return;
  }

  currentUser = user;
  renderUser(user, user.displayName);
  loadProfile(user);
});
