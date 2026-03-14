const adminPriceInput = document.getElementById("adminPrice");
const adminPasswordInput = document.getElementById("adminPassword");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const adminMessage = document.getElementById("adminMessage");

async function loadConfigAdmin() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    const price = data.pricePerMeter ?? data.PricePerMeter ?? 10000;
    adminPriceInput.value = price;
  } catch (e) {
    console.error(e);
  }
}

saveConfigBtn.addEventListener("click", async () => {
  const price = parseFloat(adminPriceInput.value) || 0;
  const password = adminPasswordInput.value.trim();

  adminMessage.textContent = "";

  if (!password) {
    adminMessage.textContent = "Debe ingresar la contraseña.";
    return;
  }

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ PricePerMeter: price })
    });

    if (!res.ok) {
      adminMessage.textContent = "Error al guardar. Revise la contraseña.";
      return;
    }

    adminMessage.textContent = "Precio actualizado correctamente.";
  } catch (e) {
    console.error(e);
    adminMessage.textContent = "Error de conexión.";
  }
});

loadConfigAdmin();
