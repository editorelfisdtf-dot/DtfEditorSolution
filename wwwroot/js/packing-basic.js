const BasicPacker = {
    pack(canvas, maxWidthCm) {
        const ppi = 37.795;
        const margin = 1 * ppi; // Margen de 1cm
        const spacing = 12; // Espaciado entre diseños (en px)

        // El ancho máximo real es el ancho de la mesa menos los dos márgenes
        const usableWidthPx = (maxWidthCm * ppi) - (margin * 2);

        let currentX = margin;
        let currentY = margin;
        let rowHeight = 0;

        const objects = canvas.getObjects().filter(o => o.type === 'image');

        objects.forEach(obj => {
            // Asegurar origen en top-left para colocar por coordenadas de esquina
            obj.set({ originX: 'left', originY: 'top' });
            obj.setCoords();

            const rect = obj.getBoundingRect(true);
            const w = rect.width;
            const h = rect.height;

            // Si al sumar el objeto sobrepasa el ancho usable, saltamos de fila
            if (currentX + w > margin + usableWidthPx) {
                currentX = margin;
                currentY += rowHeight + spacing;
                rowHeight = 0;
            }

            // Colocar objeto respetando margen izquierdo
            obj.set({
                left: currentX,
                top: currentY
            });

            currentX += w + spacing;
            rowHeight = Math.max(rowHeight, h);
            obj.setCoords();
        });

        canvas.renderAll();
        // Ajustar el largo visual del canvas si existe la función
        if (typeof ajustarLargoDinamico === "function") ajustarLargoDinamico();
    }
};