
"use strict";

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);

    if (!input) return;

    const visible = input.type === "password";

    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password"
    );
  });
});

const passwordInput = document.getElementById("registerPassword");

if (passwordInput) {
  passwordInput.addEventListener("input", () => {
    const password = passwordInput.value;
    const bar = document.getElementById("strengthBar");
    const label = document.getElementById("strengthText");

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const colors = [
      "transparent",
      "#f43f5e",
      "#fb923c",
      "#facc15",
      "#22d3ee",
      "#10b981"
    ];

    const labels = [
      "Use at least 8 characters.",
      "Very Weak",
      "Weak",
      "Fair",
      "Strong",
      "Very Strong"
    ];

    bar.style.width = `${score * 20}%`;
    bar.style.background = colors[score];
    label.textContent = labels[score];
  });
}
