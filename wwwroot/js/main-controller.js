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
        
        // Calculamos el tamaño lógico (sin zoom) para abarcar correctamente toda el área virtual
        const logicalWidth = Math.max(window.canvas.width / zoom, 58 * ppi);
        const logicalHeight = Math.max(window.canvas.height / zoom, 100 * ppi);

        ctx.save();
        
        // TRUCO: Escalar el contexto hacia el zoom precalado, de este modo 
        // nuestras mediciones lógicos cuadran a la perfección con la visual y no se recortan en 45cm 
        ctx.scale(zoom, zoom);
        
        // Líneas de grilla
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1 / zoom;
        for (let x = 0; x <= logicalWidth; x += ppi) {
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x, logicalHeight); 
            ctx.stroke();
        }
        for (let y = 0; y <= logicalHeight; y += ppi) {
            ctx.beginPath(); 
            ctx.moveTo(0, y); 
            ctx.lineTo(logicalWidth, y); 
            ctx.stroke();
        }

        // REGLA HORIZONTAL (Superior) - Verde
        ctx.fillStyle = "#c1ff72";
        ctx.font = `${11 / zoom}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        for (let x = 0; x <= logicalWidth; x += ppi * 5) {
            ctx.fillRect(x - (1 / zoom), 0, 2 / zoom, 15 / zoom);
            ctx.fillText(`${Math.round(x / ppi)}`, x, 18 / zoom);
        }

        // REGLA VERTICAL (Izquierda) - Verde
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let y = 0; y <= logicalHeight; y += ppi * 5) {
            // Línea horizontal pequeña en la parte izquierda (10px en lugar de 20px)
            const tickW = 12 / zoom;
            ctx.fillRect(0, y - (1 / zoom), tickW, 2 / zoom);

            // Dibujar fondo oscuro detrás del número para que no se solape con líneas verdes
            const label = `${Math.round(y / ppi)}`;
            ctx.save();
            ctx.font = `${11 / zoom}px Arial`;
            const textMetrics = ctx.measureText(label);
            const padding = 4 / zoom;
            const bgW = textMetrics.width + padding * 2;
            const bgH = 14 / zoom;
            const bgX = tickW + 2 / zoom; // colocar el fondo a la derecha del tick
            const bgY = y - (bgH / 2);

            // Fondo oscuro
            ctx.fillStyle = '#0b0e14';
            ctx.fillRect(bgX, bgY, bgW, bgH);

            // Texto en verde, ligeramente desplazado dentro del fondo para evitar solape
            ctx.fillStyle = '#c1ff72';
            ctx.textAlign = 'left';
            ctx.fillText(label, bgX + padding, y);
            ctx.restore();
        }

        // MARGEN ROJO (Respetando superior e izquierdo)
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(ppi, ppi, (58 * ppi) - (ppi * 2), logicalHeight - (ppi * 2));

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
    if (!obj || isNaN(num) || num <= 0) return;

    let added = 0;
    const clones = [];

    for (let i = 0; i < num; i++) {
        // clone es asíncrono
        obj.clone(function (cloned) {
            // asegurar que la copia mantiene rotación y origen
            cloned.set({
                originX: 'center',
                originY: 'center',
                angle: obj.angle || 0
            });

            // colocar provisionalmente cerca del original para visualización inmediata
            const offset = 10 * (i + 1);
            // usar coords lógicas (centro) si el objeto original usa center
            try {
                const center = obj.getCenterPoint();
                cloned.set({ left: center.x + offset, top: center.y + offset });
            } catch (e) {
                cloned.set({ left: obj.left + offset, top: obj.top + offset });
            }

            cloned.setCoords();
            window.canvas.add(cloned);
            clones.push(cloned);
            added++;

            // cuando todas las copias se han añadido, reordenar y renderizar
            if (added === num) {
                // Intentar usar el packer básico para ordenar respetando márgenes
                try {
                    if (typeof BasicPacker !== 'undefined' && typeof BasicPacker.pack === 'function') {
                        BasicPacker.pack(window.canvas, anchoMesaCm);
                    }
                } catch (e) {
                    console.warn('BasicPacker pack failed', e);
                }

                window.canvas.renderAll();
                actualizarPrecio();

                // seleccionar la última copia añadida
                if (clones.length) {
                    window.canvas.setActiveObject(clones[clones.length - 1]);
                }
            }
        });
    }
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
        try {
            // Asegurarse coords actualizadas
            obj.setCoords();
            // aCoords contiene las esquinas reales en coordenadas del canvas (sin zoom)
            const ac = obj.aCoords;
            const ys = [ac.tl.y, ac.tr.y, ac.bl.y, ac.br.y];
            const bottom = Math.max(...ys);
            if (bottom > maxBottom) maxBottom = bottom;
        } catch (e) {
            // fallback: usar bounding rect (lógico)
            const rect = obj.getBoundingRect(true);
            const bottom = rect.top + rect.height;
            if (bottom > maxBottom) maxBottom = bottom;
        }
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
        try {
            obj.setCoords();
            const ac = obj.aCoords;
            const ys = [ac.tl.y, ac.tr.y, ac.bl.y, ac.br.y];
            const bottom = Math.max(...ys);
            if (bottom > maxBottom) maxBottom = bottom;
        } catch (e) {
            const rect = obj.getBoundingRect(true);
            const bottom = rect.top + rect.height;
            if (bottom > maxBottom) maxBottom = bottom;
        }
    });

    const nuevoLargoPx = Math.max(100 * ppi, maxBottom + (2 * ppi));
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

    const anchoInternoPx = anchoMesaCm * ppi; // 58cm = 2192 px
    const anchoDisponible = contenedor.clientWidth - 40; // 40px de padding
    const factorZoom = anchoDisponible / anchoInternoPx;

    // Calcular altura basada en objetos usando aCoords
    const objects = window.canvas.getObjects('image');
    let maxBottom = 0;
    objects.forEach(obj => {
        try {
            obj.setCoords();
            const ac = obj.aCoords;
            const ys = [ac.tl.y, ac.tr.y, ac.bl.y, ac.br.y];
            const bottom = Math.max(...ys);
            if (bottom > maxBottom) maxBottom = bottom;
        } catch (e) {
            const rect = obj.getBoundingRect(true);
            const bottom = rect.top + rect.height;
            if (bottom > maxBottom) maxBottom = bottom;
        }
    });

    const alturaInternaPx = Math.max(100 * ppi, maxBottom + (15 * ppi));

    // Aplicar zoom al canvas
    window.canvas.setZoom(factorZoom);

    // Establecer dimensiones visuales del canvas
    const anchoVisual = anchoInternoPx * factorZoom;
    const alturaVisual = alturaInternaPx * factorZoom;

    window.canvas.setWidth(anchoVisual);
    window.canvas.setHeight(alturaVisual);

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

// Función para enviar el pedido
function enviarPedido() {
    const nombre = document.querySelector('input[placeholder="Tu Nombre"]').value;
    const telefono = document.querySelector('input[placeholder="Tu Teléfono"]').value;
    const precioText = document.getElementById('totalPrice').innerText;
    const largoText = document.getElementById('totalLength').innerText;

    if (!nombre || !telefono) {
        alert('Por favor completa tu nombre y teléfono');
        return;
    }

    const mensaje = `Pedido DTF:\nNombre: ${nombre}\nTeléfono: ${telefono}\n${largoText}\n${precioText}`;
    alert(mensaje + '\n\n(Esta es una versión de demostración. En producción se enviaría a un servidor)');
}
