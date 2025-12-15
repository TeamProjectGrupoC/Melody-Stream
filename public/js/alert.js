export function showAlert(message, type = "info", duration = 3000) {
  const container = document.getElementById("alert-container");

  if (!container) return;

  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  container.appendChild(alert);

  setTimeout(() => {
    alert.classList.add("hide");

    alert.addEventListener("animationend", () => {
      alert.remove();
    });
  }, duration);
}
