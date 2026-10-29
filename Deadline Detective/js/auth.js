
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

function showAuthMessage(elementId, message, type = "error") {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
}

function getErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Please choose a stronger password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled.",
    "permission-denied": "Database permission denied. Check Firestore rules."
  };

  return messages[error.code] || "Something went wrong. Please try again.";
}

function setButtonLoading(button, loading, defaultText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : defaultText;
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const button = document.getElementById("registerButton");

    if (name.length < 2 || name.length > 80) {
      showAuthMessage("registerMessage", "Enter a valid full name.");
      return;
    }

    if (password.length < 8) {
      showAuthMessage("registerMessage", "Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("registerMessage", "Passwords do not match.");
      return;
    }

    setButtonLoading(button, true, "Create Account");

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, {
        displayName: name
      });

      await setDoc(doc(db, "users", result.user.uid), {
        name,
        email: result.user.email,
        createdAt: serverTimestamp()
      });

      showAuthMessage(
        "registerMessage",
        "Account created successfully!",
        "success"
      );

      window.location.replace("dashboard.html");

    } catch (error) {
      showAuthMessage("registerMessage", getErrorMessage(error));
    } finally {
      setButtonLoading(button, false, "Create Account");
    }
  });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const button = document.getElementById("loginButton");

    setButtonLoading(button, true, "Sign In");

    try {
      await signInWithEmailAndPassword(auth, email, password);

      showAuthMessage(
        "loginMessage",
        "Login successful!",
        "success"
      );

      window.location.replace("dashboard.html");

    } catch (error) {
      showAuthMessage("loginMessage", getErrorMessage(error));
    } finally {
      setButtonLoading(button, false, "Sign In");
    }
  });
}


const forgotPassword = document.getElementById("forgotPassword");

if (forgotPassword) {
  forgotPassword.addEventListener("click", async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById("loginEmail");
    const email = emailInput.value.trim();

    if (!email) {
      showAuthMessage(
        "loginMessage",
        "Please enter your email address first.",
        "error"
      );
      emailInput.focus();
      return;
    }

    if (!emailInput.checkValidity()) {
      showAuthMessage(
        "loginMessage",
        "Please enter a valid email address.",
        "error"
      );
      emailInput.focus();
      return;
    }

    forgotPassword.style.pointerEvents = "none";
    forgotPassword.textContent = "Sending...";

    try {
      await sendPasswordResetEmail(auth, email);

      showAuthMessage(
        "loginMessage",
        "If an account exists for this email, a password reset link will be sent.",
        "success"
      );

    } catch (error) {
      console.error("Password reset error:", error);

      showAuthMessage(
        "loginMessage",
        getErrorMessage(error),
        "error"
      );

    } finally {
      forgotPassword.style.pointerEvents = "";
      forgotPassword.textContent = "Forgot Password?";
    }
  });
}


const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("login.html");
    } catch (error) {
      alert(getErrorMessage(error));
    }
  });
}

const protectedPage = document.body.dataset.protected === "true";

if (protectedPage) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    const nameElement = document.getElementById("studentName");
    const emailElement = document.getElementById("studentEmail");

    if (nameElement) {
      nameElement.textContent = user.displayName || "Student";
    }

    if (emailElement) {
      emailElement.textContent = user.email || "";
    }

    document.body.hidden = false;
  });
}
