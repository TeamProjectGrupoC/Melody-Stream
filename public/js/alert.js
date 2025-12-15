export function showAlert(message, type = "info", duration = 2500) {
  const container = document.getElementById("alert-container");

  if (!container) {
    console.error("Alert container not found");
    return;
  }

  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  container.appendChild(alert);

  // Ocultar tras X tempo
  setTimeout(() => {
    alert.classList.add("hide");

    // Eliminar do DOM cando remata a animación
    alert.addEventListener("animationend", () => {
      alert.remove();
    });
  }, duration);
}
