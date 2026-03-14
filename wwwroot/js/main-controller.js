const ppi = 37.795;
const anchoMesaCm = 58;
let precioPorMetro = 10000;

window.addEventListener('load', () => {
    initCanvas();
    cargarConfiguracion();
    setupPropertyListeners();
    ajustarLargoDinamico();
});

function initCanvas() {
    window.canvas = new fabric.Canvas('canvasDTF', {
        width: 58 * 37.795,
        height: 100 * 37.795,
        backgroundColor: '#1a1a1a',
        selection: true,
        renderOnAddRemove: false
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
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x, window.canvas.height); 
            ctx.stroke();
        }
        for (let y = 0; y <= window.canvas.height; y += ppi) {
            ctx.beginPath(); 
            ctx.moveTo(0, y); 
            ctx.lineTo(window.canvas.width, y); 
            ctx.stroke();
        }

        // REGLA HORIZONTAL (Superior) - Verde
        ctx.fillStyle = "#c1ff72";
        ctx.font = `${14 / zoom}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        for (let x = 0; x <= window.canvas.width; x += ppi * 5) {
            // Línea vertical pequeña en la parte superior
            ctx.fillRect(x - (1 / zoom), 0, 2 / zoom, 20 / zoom);
            // Texto con el valor en cm
            ctx.fillText(`${Math.round(x / ppi)}cm`, x, 25 / zoom);
        }

        // REGLA VERTICAL (Izquierda) - Verde
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let y = 0; y <= window.canvas.height; y += ppi * 5) {
            // Línea horizontal pequeña en la parte izquierda
            ctx.fillRect(0, y - (1 / zoom), 20 / zoom, 2 / zoom);
            // Texto con el valor en cm
            ctx.fillText(`${Math.round(y / ppi)}cm`, 15 / zoom, y);
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
                actualizarPrecio();
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
    window.canvas.renderAll();
    actualizarPrecio();
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
    window.canvas.renderAll();
    actualizarPrecio();
}

function limpiarMesa() {
    if (confirm("¿Seguro que quieres borrar todo?")) {
        window.canvas.getObjects('image').forEach(obj => window.canvas.remove(obj));
        window.canvas.renderAll();
        actualizarPrecio();
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

function cambiarModo(modo) {
    const objetos = window.canvas.getObjects('image');
    if (objetos.length === 0) return;

    if (modo === 'avanzado') {
        objetos.forEach(obj => {
            obj.set({ top: 0, left: 0 });
        });

        if (typeof AdvancedPacker !== 'undefined') {
            AdvancedPacker.optimize(window.canvas, anchoMesaCm, 1000);
        }
    }

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

    const nuevoLargoPx = Math.max(100 * ppi, maxBottom + (2 * ppi));
    const zoom = window.canvas.getZoom();
    
    window.canvas.setHeight(nuevoLargoPx);
    window.canvas.height = nuevoLargoPx;

    actualizarPrecio();
}

function setupPropertyListeners() {
    if (!window.canvas) return;
    
    window.canvas.on('object:scaling', function (e) {
        actualizarInputAncho(e.target);
    });

    window.canvas.on('selection:created', (e) => actualizarInputAncho(e.selected[0]));
    window.canvas.on('selection:updated', (e) => actualizarInputAncho(e.selected[0]));

    window.canvas.on('selection:cleared', () => {
        document.getElementById('inputWidthCm').value = '';
    });
}

function actualizarInputAncho(obj) {
    const inputWidth = document.getElementById('inputWidthCm');
    if (inputWidth && obj) {
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
    activeObject.scaleToWidth(nuevoAnchoPx);
    activeObject.setCoords();
    
    window.canvas.renderAll();
    actualizarPrecio();
}

function ajustarLargoDinamico() {
    const contenedor = document.querySelector('.canvas-area');
    if (!contenedor || !window.canvas) return;

    const anchoInternoPx = anchoMesaCm * ppi; // 58cm en píxeles
    
    // Obtener ancho disponible (restamos padding)
    const anchoDisponible = contenedor.clientWidth - 60;
    
    // El factor de zoom debe ser tal que 58cm quepa perfectamente
    const factorZoom = anchoDisponible / anchoInternoPx;

    // Calcular altura basada en objetos
    const objects = window.canvas.getObjects('image');
    let maxBottom = 0;
    objects.forEach(obj => {
        const rect = obj.getBoundingRect();
        const bottom = rect.top + rect.height;
        if (bottom > maxBottom) maxBottom = bottom;
    });

    const alturaInternaPx = Math.max(100 * ppi, maxBottom + (15 * ppi));

    // Aplicar zoom
    window.canvas.setZoom(factorZoom);

    // Establecer dimensiones del canvas (ancho interno siempre 58cm)
    const anchoVisual = anchoInternoPx * factorZoom;
    const alturaVisual = alturaInternaPx * factorZoom;

    window.canvas.setWidth(anchoVisual);
    window.canvas.setHeight(alturaVisual);

    // Ajustar wrapper para que tenga exactamente el tamaño del canvas
    const wrapper = document.getElementById('wrapper');
    if (wrapper) {
        wrapper.style.width = anchoVisual + "px";
        wrapper.style.height = alturaVisual + "px";
    }

    window.canvas.renderAll();
}

function recalcularZoom() {
    const contenedor = document.querySelector('.canvas-area');
    if (!contenedor) return;

    const anchoDisponible = contenedor.clientWidth - 40;
    const anchoRealCanvas = 58 * 37.795;
    const factorZoom = anchoDisponible / anchoRealCanvas;

    window.canvas.setZoom(factorZoom);
    window.canvas.setWidth(anchoRealCanvas * factorZoom);
    window.canvas.setHeight(window.canvas.height * factorZoom);
}

window.addEventListener('resize', () => {
    ajustarLargoDinamico();
});