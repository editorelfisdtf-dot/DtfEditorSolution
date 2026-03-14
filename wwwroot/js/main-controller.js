const ppi = 37.795;
const anchoMesaCm = 58;
let precioPorMetro = 10000;

window.addEventListener('load', () => {
    initCanvas();
    cargarConfiguracion();
});

function initCanvas() {
    window.canvas = new fabric.Canvas('canvasDTF', {
        width: 58 * 37.795,
        height: 100 * 37.795,
        backgroundColor: '#1a1a1a',
        selection: true
    });

    window.canvas.on('after:render', function () {
        const ctx = window.canvas.getContext();
        const zoom = window.canvas.getZoom();
        const ppi = 37.795;

        ctx.save();
        // Líneas de grilla
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1 / zoom;
        for (let x = 0; x <= window.canvas.width; x += ppi) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, window.canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= window.canvas.height; y += ppi) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(window.canvas.width, y); ctx.stroke();
        }

        // REGLA VERTICAL (Verde)
        ctx.fillStyle = "#c1ff72";
        ctx.font = `${14 / zoom}px Arial`;
        for (let y = 0; y <= window.canvas.height; y += ppi * 5) {
            ctx.fillText(`${Math.round(y / ppi)}cm`, 10 / zoom, y - (5 / zoom));
            ctx.fillRect(0, y, 20 / zoom, 2 / zoom);
        }

        // MARGEN ROJO (Respetando superior e izquierdo)
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(ppi, ppi, (58 * ppi) - (ppi * 2), window.canvas.height - (ppi * 2));

        ctx.restore();
    });
}

// CARGA DE IMÁGENES
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (event) {
            fabric.Image.fromURL(event.target.result, function (img) {
                img.set({
                    left: ppi * 2, // Aparece a 2cm para que se vea
                    top: ppi * 2,
                    cornerColor: '#c1ff72',
                    cornerSize: 10,
                    transparentCorners: false
                });

                if (img.getScaledWidth() > (20 * ppi)) {
                    img.scaleToWidth(15 * ppi);
                }

                window.canvas.add(img);
                window.canvas.setActiveObject(img);
                window.canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    });
    e.target.value = ''; // Reset para permitir subir el mismo archivo
}

// BOTONES Y HERRAMIENTAS
function rotarSeleccion(grados) {
    const active = window.canvas.getActiveObject();
    if (!active) return;
    active.rotate((active.angle || 0) + grados);
    window.canvas.requestRenderAll();
}

function eliminarSeleccion() {
    const active = window.canvas.getActiveObject();
    if (!active) return;
    if (active.type === 'activeSelection') {
        active.forEachObject(obj => window.canvas.remove(obj));
        window.canvas.discardActiveObject();
    } else {
        window.canvas.remove(active);
    }
}

function generarCopias() {
    const obj = window.canvas.getActiveObject();
    const num = parseInt(document.getElementById('inputCopies').value);
    if (!obj || isNaN(num)) return;

    for (let i = 0; i < num; i++) {
        obj.clone(function (cloned) {
            cloned.set({
                left: obj.left + (10 * (i + 1)),
                top: obj.top + (10 * (i + 1))
            });
            window.canvas.add(cloned);
        });
    }
}

function limpiarMesa() {
    if (confirm("¿Seguro que quieres borrar todo?")) {
        window.canvas.getObjects('image').forEach(obj => window.canvas.remove(obj));
    }
}

// PRECIO Y CONFIGURACIÓN
async function cargarConfiguracion() {
    try {
        const response = await fetch('data/config.json');
        if (response.ok) {
            const config = await response.json();
            precioPorMetro = config.PricePerMeter;
        }
    } catch (e) { console.warn("Usando precio base"); }
    actualizarPrecio();
}

function actualizarPrecio() {
    const objects = window.canvas.getObjects('image');
    let maxBottom = 0;
    objects.forEach(obj => {
        const bottom = obj.getBoundingRect().top + obj.getBoundingRect().height;
        if (bottom > maxBottom) maxBottom = bottom;
    });

    const largoCm = maxBottom / ppi;
    const precioTotal = (largoCm / 100) * precioPorMetro;

    document.getElementById('totalPrice').innerText = `$${Math.round(precioTotal).toLocaleString('es-CL')}`;
    document.getElementById('totalLength').innerText = `Largo ocupado: ${largoCm.toFixed(1)} cm`;
}
// Reemplaza la función cambiarModo en main-controller.js
function cambiarModo(modo) {
    const objetos = window.canvas.getObjects('image');
    if (objetos.length === 0) return;

    if (modo === 'avanzado') {
        // 1. Antes de ordenar, movemos todo al inicio para que el motor recalcule desde arriba
        objetos.forEach(obj => {
            obj.set({ top: 0, left: 0 });
        });

        if (typeof AdvancedPacker !== 'undefined') {
            // Le pasamos un largo virtual muy grande (ej. 1000cm) para que no se sobrepongan
            AdvancedPacker.optimize(window.canvas, anchoMesaCm, 1000);
        }
    }

    // 2. Ajustar el largo del canvas al objeto que quedó más abajo
    ajustarLargoCanvasEfectivo();
    window.canvas.renderAll();
}

function ajustarLargoCanvasEfectivo() {
    const objects = window.canvas.getObjects('image');
    let maxBottom = 0;

    objects.forEach(obj => {
        const bottom = obj.getBoundingRect().top + obj.getBoundingRect().height;
        if (bottom > maxBottom) maxBottom = bottom;
    });

    // Añadimos un pequeño margen extra al final (2cm)
    const nuevoLargoPx = Math.max(100 * ppi, maxBottom + (2 * ppi));

    // Actualizamos el ancho y largo visual considerando el zoom actual
    const zoom = window.canvas.getZoom();
    window.canvas.setHeight(nuevoLargoPx * zoom);

    // Importante: Actualizar la propiedad interna para que la grilla se siga dibujando
    window.canvas.height = nuevoLargoPx;

    actualizarPrecio();
}
function setupPropertyListeners() {
    // Cuando el usuario escala la imagen con el mouse, el input se actualiza
    window.canvas.on('object:scaling', function (e) {
        actualizarInputAncho(e.target);
    });

    // Cuando el usuario hace clic en una imagen, el input muestra su ancho
    window.canvas.on('selection:created', (e) => actualizarInputAncho(e.selected[0]));
    window.canvas.on('selection:updated', (e) => actualizarInputAncho(e.selected[0]));

    // Si se deselecciona, limpiamos el input
    window.canvas.on('selection:cleared', () => {
        document.getElementById('inputWidthCm').value = '';
    });
}

function actualizarInputAncho(obj) {
    const inputWidth = document.getElementById('inputWidthCm');
    if (inputWidth && obj) {
        // Calculamos el ancho real considerando la escala actual
        const anchoActualCm = (obj.getScaledWidth() / ppi).toFixed(1);
        inputWidth.value = anchoActualCm;
    }
}

function cambiarAnchoManual() {
    const activeObject = window.canvas.getActiveObject();
    const inputWidth = document.getElementById('inputWidthCm');

    if (!activeObject || !inputWidth || inputWidth.value === "") return;

    const nuevoAnchoCm = parseFloat(inputWidth.value);
    if (isNaN(nuevoAnchoCm) || nuevoAnchoCm <= 0) return;

    const nuevoAnchoPx = nuevoAnchoCm * ppi;

    // Cambiamos el ancho manteniendo la proporción (scaleToWidth)
    activeObject.scaleToWidth(nuevoAnchoPx);

    activeObject.setCoords(); // Importante para que los controles sigan a la imagen
    window.canvas.renderAll();
    actualizarPrecio(); // El precio cambia si la imagen ocupa más espacio
}
// Agrega esta función a tu main-controller.js si no la tienes
function ajustarLargoDinamico() {
    const ppi = 37.795;
    const anchoMesaCm = 58;
    const objects = window.canvas.getObjects('image');

    let maxBottom = 0;
    objects.forEach(obj => {
        const rect = obj.getBoundingRect();
        const bottom = rect.top + rect.height;
        if (bottom > maxBottom) maxBottom = bottom;
    });

    // 1. Dimensiones internas (Resolución real de 58cm)
    const anchoInternoPx = anchoMesaCm * ppi;
    const alturaInternaPx = Math.max(100 * ppi, maxBottom + (15 * ppi));

    // 2. Cálculo del factor de zoom según tu pantalla
    const contenedor = document.querySelector('.canvas-area');
    const anchoDisponible = contenedor.clientWidth - 60;
    const factorZoom = anchoDisponible / anchoInternoPx;

    // 3. Aplicamos el zoom interno
    window.canvas.setZoom(factorZoom);

    // 4. Ajustamos el tamaño VISUAL (CSS) sin alterar la grilla interna
    window.canvas.setDimensions({
        width: anchoInternoPx * factorZoom,
        height: alturaInternaPx * factorZoom
    }, { cssOnly: true });

    // 5. Forzamos al Wrapper para que el navegador cree la barra de scroll
    const wrapper = document.getElementById('wrapper');
    if (wrapper) {
        wrapper.style.width = (anchoInternoPx * factorZoom) + "px";
        wrapper.style.height = (alturaInternaPx * factorZoom) + "px";
    }

    window.canvas.renderAll();
    actualizarPrecio();
}
function recalcularZoomYVista() {
    const contenedor = document.querySelector('.canvas-area');
    const anchoDisponible = contenedor.clientWidth - 40;
    const anchoRealCanvas = 58 * 37.795;
    const factorZoom = anchoDisponible / anchoRealCanvas;

    window.canvas.setZoom(factorZoom);
    window.canvas.setWidth(anchoRealCanvas * factorZoom);
    window.canvas.setHeight(window.canvas.height * factorZoom);
}

function recalcularZoom() {
    const contenedor = document.querySelector('.canvas-area');
    if (!contenedor) return;

    const anchoDisponible = contenedor.clientWidth - 40;
    const anchoRealCanvas = 58 * 37.795;
    const factorZoom = anchoDisponible / anchoRealCanvas;

    // Aplicamos el zoom sin cambiar el ancho interno (el ancho siempre es 58cm)
    window.canvas.setZoom(factorZoom);

    // Ajustamos el tamaño del elemento HTML del canvas para que coincida visualmente
    window.canvas.setWidth(anchoRealCanvas * factorZoom);
    window.canvas.setHeight(window.canvas.height * factorZoom);
}
// Forzar el ajuste cuando la ventana cambia de tamaño
window.addEventListener('resize', () => {
    ajustarLargoDinamico();
});

// Forzar el ajuste un segundo después de cargar (por si el panel tarda en renderizar)
setTimeout(ajustarLargoDinamico, 500);