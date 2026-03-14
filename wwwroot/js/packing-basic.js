const BasicPacker = {
    pack(canvas, maxWidthCm) {
        const ppi = 37.795;
        const margin = 1 * ppi; // Margen de 1cm
        const spacing = 15; // Espaciado entre diseños

        // El ancho máximo real es el ancho de la mesa menos los dos márgenes
        const usableWidthPx = (maxWidthCm * ppi) - (margin * 2);

        let currentX = margin;
        let currentY = margin;
        let rowHeight = 0;

        const objects = canvas.getObjects().filter(o => o.type === 'image');

        objects.forEach(obj => {
            const rect = obj.getBoundingRect();

            // Si al sumar el objeto sobrepasa el ancho usable, saltamos de fila
            if (currentX + rect.width > margin + usableWidthPx) {
                currentX = margin;
                currentY += rowHeight + spacing;
                rowHeight = 0;
            }

            obj.set({
                left: currentX,
                top: currentY
            });

            currentX += rect.width + spacing;
            rowHeight = Math.max(rowHeight, rect.height);
            obj.setCoords();
        });

        canvas.renderAll();
        if (typeof ajustarVistaCompleta === "function") {
            ajustarVistaCompleta();
        }
    }
};