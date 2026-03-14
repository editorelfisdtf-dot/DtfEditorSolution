// manual-editor.js - Control independiente de objetos y vinculación de botones
const ManualEditor = {
    canvas: null,

    init: function (canvas) {
        this.canvas = canvas;
        this.enableInteractivity();
        this.setupButtons();
        console.log("Modo Manual: Controles de usuario activados.");
    },

    // Permite que los objetos se puedan mover y seleccionar
    enableInteractivity: function () {
        this.canvas.forEachObject(obj => {
            obj.set({
                selectable: true,
                hasControls: true,
                hasBorders: true,
                lockMovementX: false,
                lockMovementY: false,
                hoverCursor: 'move'
            });
        });
        this.canvas.renderAll();
    },

    setupButtons: function () {
        // Vinculamos los IDs exactos de tu HTML
        const btnRotateLeft = document.getElementById('manualRotateLeftBtn');
        const btnRotateRight = document.getElementById('manualRotateRightBtn');
        const btnZoomOut = document.getElementById('manualZoomOutBtn');
        const btnZoomIn = document.getElementById('manualZoomInBtn');

        // Limpiamos eventos previos para evitar ejecuciones dobles
        if (btnRotateLeft) btnRotateLeft.onclick = () => this.rotate(-15);
        if (btnRotateRight) btnRotateRight.onclick = () => this.rotate(15);
        if (btnZoomIn) btnZoomIn.onclick = () => this.scale(1.1);
        if (btnZoomOut) btnZoomOut.onclick = () => this.scale(0.9);
    },

    rotate: function (degrees) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const currentAngle = activeObject.angle || 0;
            activeObject.rotate(currentAngle + degrees);
            activeObject.setCoords(); // Actualiza el área de selección
            this.canvas.requestRenderAll();
        } else {
            alert("Selecciona una imagen primero para rotarla.");
        }
    },

    scale: function (factor) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const newScaleX = activeObject.scaleX * factor;
            const newScaleY = activeObject.scaleY * factor;

            // Límite de seguridad para que la imagen no desaparezca
            if (newScaleX > 0.05 && newScaleX < 10) {
                activeObject.set({
                    scaleX: newScaleX,
                    scaleY: newScaleY
                });
                activeObject.setCoords();
                this.canvas.requestRenderAll();
            }
        } else {
            alert("Selecciona una imagen primero para cambiar su tamaño.");
        }
    }
};