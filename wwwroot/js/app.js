// =========================
// Configuración general
// =========================
const fileInput = document.getElementById("fileInput");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const previewPanel = document.getElementById("previewPanel");
const previewList = document.getElementById("previewList");
const marginMmInput = document.getElementById("marginMm");
const pricePerMeterValue = document.getElementById("pricePerMeterValue");
const priceInfo = document.getElementById("priceInfo");
const lengthInfo = document.getElementById("lengthInfo");
const generateBtn = document.getElementById("generateBtn");
const advancedBtn = document.getElementById("advancedBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
window.loadingOverlay = loadingOverlay;
const manualModeBtn = document.getElementById("manualModeBtn");
const clientNameInput = document.getElementById("clientName");
const clientPhoneInput = document.getElementById("clientPhone");
const emailBtn = document.getElementById("emailBtn");

const manualPanel = document.getElementById("manualPanel");
const manualCanvas = document.getElementById("manualCanvas");
const manualCtx = manualCanvas.getContext("2d");
const manualGenerateBtn = document.getElementById("manualGenerateBtn");
const manualExitBtn = document.getElementById("manualExitBtn");
const manualRotateLeftBtn = document.getElementById("manualRotateLeftBtn");
const manualRotateRightBtn = document.getElementById("manualRotateRightBtn");
const manualZoomOutBtn = document.getElementById("manualZoomOutBtn");
const manualZoomInBtn = document.getElementById("manualZoomInBtn");

const DPI = 300;
const pxPerCm = DPI / 2.54;
const pxPerMm = pxPerCm / 10;
const FIXED_WIDTH_CM = 57;

// MUY IMPORTANTE: NO reasignar este arreglo, solo limpiar con length = 0
const imagesData = [];
window.imagesData = imagesData; // para advanced/ultra

let lastLayout = null;
let currentPricePerMeter = 10000;
let currentMode = "auto"; // "auto" | "advanced" | "manual"

window.lastLayout = lastLayout;
window.currentModeRef = () => currentMode;
window.setMode = (mode) => {
    currentMode = mode;
};
window.exitManualIfNeeded = function (from) {
    if (currentMode === "manual") {
        currentMode = "auto";
        if (manualPanel) manualPanel.style.display = "none";
        if (previewPanel) previewPanel.style.display = "";
    }
};

// Modo manual
let manualSprites = [];
let manualSelectedId = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// =========================
// Cargar precio desde API
// =========================
async function loadConfig() {
    try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const data = await res.json();
        const price = data.pricePerMeter ?? data.PricePerMeter ?? 10000;
        currentPricePerMeter = price;

        pricePerMeterValue.textContent = price.toLocaleString("es-CL", {
            style: "currency",
            currency: "CLP"
        });
    } catch (e) {
        console.error("Error cargando config", e);
    }
}
loadConfig();

// =========================
// Recorte duro alfa > 0
// =========================
function autoCrop(img) {
    const w = img.width;
    const h = img.height;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3];
            if (a > 0) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX <= minX || maxY <= minY) {
        return img;
    }

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const octx = out.getContext("2d");
    octx.drawImage(img, minX, minY, cw, ch, 0, 0, cw, ch);
    return out;
}

// =========================
// Manejo de archivos
// =========================
fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file) => {
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const cropped = autoCrop(img);
                const baseWcm = cropped.width / pxPerCm;
                const baseHcm = cropped.height / pxPerCm;

                const data = {
                    id: Date.now() + "-" + Math.random().toString(16).slice(2),
                    img: cropped,
                    name: file.name,
                    copies: 1,
                    scalePercent: 100,
                    rotate90: false,
                    baseWcm,
                    baseHcm
                };

                imagesData.push(data);
                addPreviewItem(data);
                resetLayoutState();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // necesario para poder volver a subir el mismo archivo si se quiere
    fileInput.value = "";
});

function resetLayoutState() {
    clearCanvas();
    lengthInfo.textContent = "–";
    priceInfo.textContent = "$0";
    lastLayout = null;
    downloadBtn.disabled = true;
    // Volver al modo automático y mostrar preview
    currentMode = "auto";
    previewPanel.style.display = "";
    manualPanel.style.display = "none";
}

function addPreviewItem(data) {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-item";
    wrapper.dataset.id = data.id;

    const topRow = document.createElement("div");
    topRow.className = "preview-item-top";

    const titleSpan = document.createElement("span");
    titleSpan.className = "preview-item-title";
    titleSpan.textContent = data.name || "Imagen";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "secondary";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", () => {
        const idx = imagesData.findIndex(x => x.id === data.id);
        if (idx >= 0) imagesData.splice(idx, 1); // NO reasignar imagesData
        wrapper.remove();
        resetLayoutState();
    });

    topRow.appendChild(titleSpan);
    topRow.appendChild(deleteBtn);

    const imgEl = document.createElement("img");
    imgEl.src = data.img.toDataURL();

    const copiesLabel = document.createElement("label");
    copiesLabel.textContent = "Copias:";
    const copiesInput = document.createElement("input");
    copiesInput.type = "number";
    copiesInput.min = "1";
    copiesInput.value = "1";
    copiesInput.style.width = "60px";
    copiesInput.addEventListener("change", () => {
        const v = parseInt(copiesInput.value, 10);
        data.copies = isNaN(v) || v < 1 ? 1 : v;
        copiesInput.value = data.copies;
        resetLayoutState();
    });
    copiesLabel.appendChild(copiesInput);

    const controlsDiv = document.createElement("div");
    controlsDiv.className = "inline-controls";

    function applyScaleFromWidth(newWcm) {
        let scale;
        if (!data.rotate90) {
            scale = newWcm / data.baseWcm;
        } else {
            scale = newWcm / data.baseHcm;
        }
        if (scale > 0) {
            data.scalePercent = scale * 100;
            updateSizeInputs();
            resetLayoutState();
        }
    }

    function applyScaleFromHeight(newHcm) {
        let scale;
        if (!data.rotate90) {
            scale = newHcm / data.baseHcm;
        } else {
            scale = newHcm / data.baseWcm;
        }
        if (scale > 0) {
            data.scalePercent = scale * 100;
            updateSizeInputs();
            resetLayoutState();
        }
    }

    const widthLabel = document.createElement("label");
    widthLabel.textContent = "Ancho (cm):";
    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.step = "0.1";
    widthInput.min = "0.1";
    widthLabel.appendChild(widthInput);

    const heightLabel = document.createElement("label");
    heightLabel.textContent = "Alto (cm):";
    const heightInput = document.createElement("input");
    heightInput.type = "number";
    heightInput.step = "0.1";
    heightInput.min = "0.1";
    heightLabel.appendChild(heightInput);

    const rotateLabel = document.createElement("label");
    rotateLabel.textContent = "Rotar 90°";
    const rotateInput = document.createElement("input");
    rotateInput.type = "checkbox";
    rotateInput.addEventListener("change", () => {
        data.rotate90 = rotateInput.checked;
        updateSizeInputs();
        resetLayoutState();
    });
    rotateLabel.prepend(rotateInput);

    function updateSizeInputs() {
        const scale = data.scalePercent / 100;
        let wcm, hcm;
        if (!data.rotate90) {
            wcm = data.baseWcm * scale;
            hcm = data.baseHcm * scale;
        } else {
            wcm = data.baseHcm * scale;
            hcm = data.baseWcm * scale;
        }
        widthInput.value = wcm.toFixed(1);
        heightInput.value = hcm.toFixed(1);
    }

    widthInput.addEventListener("change", () => {
        const v = parseFloat(widthInput.value);
        if (v > 0) applyScaleFromWidth(v); else updateSizeInputs();
    });

    heightInput.addEventListener("change", () => {
        const v = parseFloat(heightInput.value);
        if (v > 0) applyScaleFromHeight(v); else updateSizeInputs();
    });

    controlsDiv.appendChild(widthLabel);
    controlsDiv.appendChild(heightLabel);
    controlsDiv.appendChild(rotateLabel);

    wrapper.appendChild(topRow);
    wrapper.appendChild(imgEl);
    wrapper.appendChild(copiesLabel);
    wrapper.appendChild(controlsDiv);

    previewList.appendChild(wrapper);

    updateSizeInputs();
}

function clearCanvas() {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}

// =========================
// Layout básico
// =========================
function buildItems() {
    const items = [];
    imagesData.forEach(data => {
        for (let i = 0; i < data.copies; i++) {
            const scale = data.scalePercent / 100;
            const wpx = (!data.rotate90
                ? data.baseWcm * scale * pxPerCm
                : data.baseHcm * scale * pxPerCm);
            const hpx = (!data.rotate90
                ? data.baseHcm * scale * pxPerCm
                : data.baseWcm * scale * pxPerCm);

            items.push({ data, wpx, hpx });
        }
    });
    return items;
}

function generateLayout(canvasWidthPx, marginPx) {
    const items = buildItems();
    if (!items.length) return null;

    let x = 0;
    let y = 0;
    let rowH = 0;
    const positions = [];

    items.forEach(item => {
        if (x + item.wpx > canvasWidthPx) {
            x = 0;
            y += rowH + marginPx;
            rowH = 0;
        }
        positions.push({ item, x, y });
        x += item.wpx + marginPx;
        if (item.hpx > rowH) rowH = item.hpx;
    });

    const usedHeight = y + rowH;
    return { positions, usedHeight };
}

function drawRuler(ctx, widthPx, rh, pxPerCm) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, rh);

    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(0, rh - 1);
    ctx.lineTo(widthPx, rh - 1);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px system-ui";

    const totalCm = widthPx / pxPerCm;
    for (let cm = 0; cm <= totalCm; cm++) {
        const x = Math.round(cm * pxPerCm);
        const isBig = cm % 5 === 0;
        const tick = isBig ? rh * 0.8 : rh * 0.4;

        ctx.beginPath();
        ctx.moveTo(x, rh);
        ctx.lineTo(x, rh - tick);
        ctx.stroke();

        if (isBig) {
            ctx.save();
            ctx.translate(x, rh - tick - 4);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = "right";
            ctx.fillText(cm.toString(), 0, 0);
            ctx.restore();
        }
    }

    ctx.restore();
}

function renderLayout(layout, widthPx, withRuler = true) {
    const rulerHeight = withRuler ? 60 : 0;
    const totalHeight = layout.usedHeight + rulerHeight;

    previewCanvas.width = widthPx;
    previewCanvas.height = totalHeight;

    clearCanvas();

    if (withRuler) {
        drawRuler(previewCtx, widthPx, rulerHeight, pxPerCm);
    }

    layout.positions.forEach(p => {
        const { data, wpx, hpx } = p.item;
        previewCtx.save();
        previewCtx.translate(p.x, p.y + rulerHeight);

        if (data.rotate90) {
            previewCtx.translate(wpx, 0);
            previewCtx.rotate(Math.PI / 2);
            previewCtx.drawImage(data.img, 0, -wpx, hpx, wpx);
        } else {
            previewCtx.drawImage(data.img, 0, 0, wpx, hpx);
        }

        previewCtx.restore();
    });

    const lengthCm = layout.usedHeight / pxPerCm;
    lengthInfo.textContent = lengthCm.toFixed(1) + " cm";

    const meters = lengthCm / 100;
    const totalPrice = meters * currentPricePerMeter;
    priceInfo.textContent = totalPrice.toLocaleString("es-CL", {
        style: "currency",
        currency: "CLP"
    });

    // guardar layout actual para descargas (auto/advanced)
    lastLayout = layout;
    window.lastLayout = layout;

    downloadBtn.disabled = false;
    if (emailBtn) emailBtn.disabled = false;
}

// =========================
// Botones básicos
// =========================
generateBtn.addEventListener("click", () => {
    if (!imagesData.length) {
        alert("Primero sube al menos una imagen PNG.");
        return;
    }

    currentMode = "auto";
    const marginMm = Math.max(4, parseFloat(marginMmInput.value) || 4);
    marginMmInput.value = marginMm;
    const marginPx = marginMm * pxPerMm;
    const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);

    const layout = generateLayout(widthPx, marginPx);
    if (!layout) return;
    lastLayout = layout;

    // salir de manual si estaba
    previewPanel.style.display = "";
    manualPanel.style.display = "none";

    renderLayout(layout, widthPx, true);
});

clearBtn.addEventListener("click", () => {
    imagesData.length = 0; // limpiar sin reasignar
    previewList.innerHTML = "";
    resetLayoutState();
});

// =========================
// Descarga: modo auto / manual
// =========================
downloadBtn.addEventListener("click", () => {
    if (currentMode === "manual") {
        downloadManual();
    } else {
        downloadAutoLike();
    }
});

function downloadAutoLike() {
    if (!lastLayout) return;

    const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);
    const heightPx = lastLayout.usedHeight;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = widthPx;
    exportCanvas.height = heightPx;
    const ectx = exportCanvas.getContext("2d");

    ectx.clearRect(0, 0, widthPx, heightPx);

    lastLayout.positions.forEach(p => {
        const { data, wpx, hpx } = p.item;
        ectx.save();
        ectx.translate(p.x, p.y);

        if (data.rotate90) {
            ectx.translate(wpx, 0);
            ectx.rotate(Math.PI / 2);
            ectx.drawImage(data.img, 0, -wpx, hpx, wpx);
        } else {
            ectx.drawImage(data.img, 0, 0, wpx, hpx);
        }

        ectx.restore();
    });

    const link = document.createElement("a");
    link.download = "mesa-dtf-57cm.png";
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
}


// =========================
// Enviar mesa por correo
// =========================
if (emailBtn) {
    emailBtn.addEventListener("click", async () => {
        if (emailBtn.disabled) return;

        const name = (clientNameInput?.value || "").trim();
        const phone = (clientPhoneInput?.value || "").trim();

        if (!name || !phone) {
            alert("Por favor ingresa nombre y teléfono del cliente antes de enviar.");
            return;
        }

        let dataUrl = null;
        let modeForSend = currentMode;
        if (currentMode === "manual") {
            if (!manualSprites.length) {
                alert("No hay mesa manual para enviar.");
                return;
            }
            dataUrl = exportManualDataUrl();
        } else {
            if (!lastLayout) {
                alert("Primero genera la mesa de trabajo.");
                return;
            }
            dataUrl = exportAutoDataUrl();
            if (!modeForSend || modeForSend === "manual") {
                modeForSend = "auto";
            }
        }

        try {
            emailBtn.disabled = true;
            const originalText = emailBtn.textContent;
            emailBtn.textContent = "Enviando...";

            const res = await fetch("/api/send-mesa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userName: name,
                    phone: phone,
                    mode: modeForSend,
                    imageBase64: dataUrl
                })
            });

            if (!res.ok) {
                alert("No se pudo enviar el correo. Intenta nuevamente.");
            } else {
                alert("Mesa enviada correctamente al correo configurado.");
            }

            emailBtn.textContent = originalText;
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error al enviar el correo.");
        } finally {
            emailBtn.disabled = false;
        }
    });
}

function exportAutoDataUrl() {
    if (!lastLayout) return null;

    const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);
    const heightPx = lastLayout.usedHeight;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = widthPx;
    exportCanvas.height = heightPx;
    const ectx = exportCanvas.getContext("2d");
    ectx.fillStyle = "#ffffff";
    ectx.fillRect(0, 0, widthPx, heightPx);

    lastLayout.positions.forEach(p => {
        const { data, wpx, hpx } = p.item;
        ectx.save();
        ectx.translate(p.x, p.y);

        if (data.rotate90) {
            ectx.translate(wpx, 0);
            ectx.rotate(Math.PI / 2);
            ectx.drawImage(data.img, 0, -wpx, hpx, wpx);
        } else {
            ectx.drawImage(data.img, 0, 0, wpx, hpx);
        }

        ectx.restore();
    });

    return exportCanvas.toDataURL("image/png");
}

function exportManualDataUrl() {
    if (!manualSprites.length) return null;

    const widthPx = manualCanvas.width;
    const rulerHeight = 60;
    const heightPx = manualCanvas.height - rulerHeight;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = widthPx;
    exportCanvas.height = heightPx;
    const ectx = exportCanvas.getContext("2d");
    ectx.fillStyle = "#ffffff";
    ectx.fillRect(0, 0, widthPx, heightPx);

    manualSprites.forEach(sprite => {
        ectx.save();
        ectx.translate(sprite.x, sprite.y - rulerHeight);
        ectx.rotate(sprite.angle);
        const w = sprite.baseWpx * sprite.scale;
        const h = sprite.baseHpx * sprite.scale;
        ectx.drawImage(sprite.data.img, -w / 2, -h / 2, w, h);
        ectx.restore();
    });

    return exportCanvas.toDataURL("image/png");
}


// =========================
// MODO MANUAL
// =========================
manualModeBtn.addEventListener("click", () => {
    if (!imagesData.length) {
        alert("Primero sube al menos una imagen PNG.");
        return;
    }
    currentMode = "manual";
    previewPanel.style.display = "none";
    manualPanel.style.display = "";
    manualCanvas.style.cursor = "default";
});

// botón salir manual
manualExitBtn.addEventListener("click", () => {
    currentMode = "auto";
    manualPanel.style.display = "none";
    previewPanel.style.display = "";
});

// Construye sprites (una por copia) con separación
function buildManualSprites() {
    const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);
    const marginPx = (Math.max(4, parseFloat(marginMmInput.value) || 4)) * pxPerMm;

    const sprites = [];
    let x = marginPx;
    let y = marginPx + 60; // dejar espacio para regla
    let rowH = 0;

    imagesData.forEach(data => {
        const scale = data.scalePercent / 100;
        const baseWpx = data.baseWcm * pxPerCm;
        const baseHpx = data.baseHcm * pxPerCm;
        const wpxScaled = baseWpx * scale;
        const hpxScaled = baseHpx * scale;

        for (let i = 0; i < data.copies; i++) {
            if (x + wpxScaled + marginPx > widthPx) {
                x = marginPx;
                y += rowH + marginPx;
                rowH = 0;
            }

            sprites.push({
                id: data.id + "_copy_" + i,
                data,
                x: x + wpxScaled / 2,
                y: y + hpxScaled / 2,
                angle: data.rotate90 ? Math.PI / 2 : 0,
                scale: scale,
                baseWpx,
                baseHpx
            });

            x += wpxScaled + marginPx;
            if (hpxScaled > rowH) rowH = hpxScaled;
        }
    });

    const usedHeight = y + rowH + marginPx;
    return { sprites, usedHeight };
}

function drawManualCanvas() {
    const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);
    const rulerHeight = 60;

    let maxY = rulerHeight + 200;
    manualSprites.forEach(s => {
        const diag = Math.max(s.baseWpx, s.baseHpx) * s.scale;
        const bottom = s.y + diag;
        if (bottom > maxY) maxY = bottom + 20;
    });

    manualCanvas.width = widthPx;
    manualCanvas.height = maxY;

    manualCtx.clearRect(0, 0, widthPx, maxY);
    drawRuler(manualCtx, widthPx, rulerHeight, pxPerCm);

    manualSprites.forEach(sprite => {
        manualCtx.save();
        manualCtx.translate(sprite.x, sprite.y);
        manualCtx.rotate(sprite.angle);
        const w = sprite.baseWpx * sprite.scale;
        const h = sprite.baseHpx * sprite.scale;
        manualCtx.drawImage(sprite.data.img, -w / 2, -h / 2, w, h);

        if (sprite.id === manualSelectedId) {
            manualCtx.strokeStyle = "#22c55e";
            manualCtx.lineWidth = 2;
            manualCtx.strokeRect(-w / 2, -h / 2, w, h);
        }

        manualCtx.restore();
    });
}

// Hit test con ciclo entre sprites solapados
function hitTestSprite(mx, my) {
    const rulerHeight = 60;
    const hits = [];

    for (let i = 0; i < manualSprites.length; i++) {
        const s = manualSprites[i];
        const dx = mx - s.x;
        const dy = my - s.y;

        const cos = Math.cos(-s.angle);
        const sin = Math.sin(-s.angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        const w = s.baseWpx * s.scale;
        const h = s.baseHpx * s.scale;

        if (Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2) {
            hits.push(s.id);
        }
    }

    if (!hits.length) return null;

    // si hay varias, alternar entre ellas con clics sucesivos
    if (!manualSelectedId || !hits.includes(manualSelectedId)) {
        return hits[0];
    } else {
        const idx = hits.indexOf(manualSelectedId);
        const nextIdx = (idx + 1) % hits.length;
        return hits[nextIdx];
    }
}

// Eventos mouse para arrastrar
manualCanvas.addEventListener("mousedown", (e) => {
    if (!manualSprites.length) return;
    const rect = manualCanvas.getBoundingClientRect();
    const scaleX = manualCanvas.width / rect.width;
    const scaleY = manualCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const hitId = hitTestSprite(mx, my);
    if (hitId) {
        manualSelectedId = hitId;
        isDragging = true;
        const sprite = manualSprites.find(s => s.id === hitId);
        dragOffsetX = mx - sprite.x;
        dragOffsetY = my - sprite.y;
        manualCanvas.style.cursor = "grabbing";
        drawManualCanvas();
    } else {
        manualSelectedId = null;
        drawManualCanvas();
    }
});

manualCanvas.addEventListener("mousemove", (e) => {
    if (!isDragging || !manualSelectedId) return;
    const rect = manualCanvas.getBoundingClientRect();
    const scaleX = manualCanvas.width / rect.width;
    const scaleY = manualCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const sprite = manualSprites.find(s => s.id === manualSelectedId);
    if (!sprite) return;

    sprite.x = mx - dragOffsetX;
    sprite.y = my - dragOffsetY;
    drawManualCanvas();
});

window.addEventListener("mouseup", () => {
    isDragging = false;
    manualCanvas.style.cursor = "grab";
});

// Controles de rotación / zoom
function getSelectedSprite() {
    if (!manualSelectedId) return null;
    return manualSprites.find(s => s.id === manualSelectedId) || null;
}

function nudgeSelected(params) {
    const sprite = getSelectedSprite();
    if (!sprite) return;

    if (params.angleDelta) {
        sprite.angle += params.angleDelta;
    }
    if (params.scaleFactor) {
        const newScale = sprite.scale * params.scaleFactor;
        sprite.scale = Math.max(0.1, Math.min(newScale, 10));
    }
    drawManualCanvas();
}

manualRotateLeftBtn.addEventListener("click", () => {
    nudgeSelected({ angleDelta: -Math.PI / 12 });
});
manualRotateRightBtn.addEventListener("click", () => {
    nudgeSelected({ angleDelta: Math.PI / 12 });
});
manualZoomOutBtn.addEventListener("click", () => {
    nudgeSelected({ scaleFactor: 0.9 });
});
manualZoomInBtn.addEventListener("click", () => {
    nudgeSelected({ scaleFactor: 1.1 });
});

// Crear/actualizar sprites al presionar botón
manualGenerateBtn.addEventListener("click", () => {
    if (!imagesData.length) {
        alert("Primero sube al menos una imagen PNG.");
        return;
    }

    currentMode = "manual";
    previewPanel.style.display = "none";
    manualPanel.style.display = "";

    const built = buildManualSprites();
    manualSprites = built.sprites;
    manualSelectedId = manualSprites.length ? manualSprites[0].id : null;

    manualCanvas.style.cursor = "grab";
    drawManualCanvas();
    downloadBtn.disabled = false;
    if (emailBtn) emailBtn.disabled = false;
});

// Descarga desde modo manual (quitando la regla)
function downloadManual() {
    if (!manualSprites.length) return;

    const widthPx = manualCanvas.width;
    const rulerHeight = 60;
    const heightPx = manualCanvas.height - rulerHeight;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = widthPx;
    exportCanvas.height = heightPx;
    const ectx = exportCanvas.getContext("2d");

    ectx.clearRect(0, 0, widthPx, heightPx);

    manualSprites.forEach(sprite => {
        ectx.save();
        ectx.translate(sprite.x, sprite.y - rulerHeight);
        ectx.rotate(sprite.angle);
        const w = sprite.baseWpx * sprite.scale;
        const h = sprite.baseHpx * sprite.scale;
        ectx.drawImage(sprite.data.img, -w / 2, -h / 2, w, h);
        ectx.restore();
    });

    const link = document.createElement("a");
    link.download = "mesa-dtf-manual-57cm.png";
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
}

// Exponer funciones/valores necesarios para advanced / ultra
window.buildItems = buildItems;
window.renderLayout = renderLayout;
window.pxPerCm = pxPerCm;
window.pxPerMm = pxPerMm;
window.FIXED_WIDTH_CM = FIXED_WIDTH_CM;
window.marginMmInput = marginMmInput;
