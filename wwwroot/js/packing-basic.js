const BasicPacker = {
    pack(canvas, maxWidthCm) {
        const ppi = 37.795;
        const margin = 1 * ppi; // Margen de 1cm
        const spacing = 12; // Espaciado entre diseños (en px)

        const totalWidthPx = maxWidthCm * ppi;
        const usableLeft = margin;
        const usableRight = totalWidthPx - margin;
        const usableWidthPx = usableRight - usableLeft;

        const objects = canvas.getObjects().filter(o => o.type === 'image');
        if (!objects.length) return;

        // Normalizar origen y actualizar coordenadas
        objects.forEach(o => {
            try {
                const c = o.getCenterPoint();
                o.set({ originX: 'center', originY: 'center', left: c.x, top: c.y });
                o.setCoords();
            } catch (e) { /* ignore */ }
        });

        // Preparar items con AABB medidas
        const items = objects.map(o => {
            o.setCoords();
            const w = getAABBWidth(o);
            const h = getAABBHeight(o);
            return { o, w, h };
        }).sort((a, b) => b.h - a.h);

        // Shelves (rows) with best-fit placement: choose shelf with smallest leftover that fits
        const shelves = [];

        for (const item of items) {
            // if too wide, cap width to usableWidthPx
            if (item.w > usableWidthPx) item.w = Math.min(item.w, usableWidthPx - spacing);

            // find best shelf (minimum leftover after place)
            let bestShelf = null;
            let bestLeftover = Infinity;
            for (const shelf of shelves) {
                const leftover = (usableLeft + usableWidthPx) - shelf.xCursor - item.w;
                if (leftover >= 0 && leftover < bestLeftover) {
                    bestLeftover = leftover;
                    bestShelf = shelf;
                }
            }

            if (bestShelf) {
                const centerX = bestShelf.xCursor + item.w / 2;
                const centerY = bestShelf.y + item.h / 2;
                item.o.set({ left: centerX, top: centerY, originX: 'center', originY: 'center' });
                item.o.setCoords();
                bestShelf.xCursor += item.w + spacing;
                bestShelf.height = Math.max(bestShelf.height, item.h);
            } else {
                // create new shelf at the current max bottom of shelves
                const y = shelves.length === 0 ? margin : (Math.max(...shelves.map(s => s.y + s.height)) + spacing);
                const centerX = usableLeft + item.w / 2;
                const centerY = y + item.h / 2;
                item.o.set({ left: centerX, top: centerY, originX: 'center', originY: 'center' });
                item.o.setCoords();
                shelves.push({ xCursor: usableLeft + item.w + spacing, y: y, height: item.h });
            }
        }

        canvas.renderAll();
        if (typeof ajustarLargoDinamico === "function") ajustarLargoDinamico();

        // helpers
        function getAABBWidth(o) {
            const w = o.getScaledWidth();
            const h = o.getScaledHeight();
            const angle = ((o.angle || 0) * Math.PI) / 180;
            const ex = Math.abs((w / 2) * Math.cos(angle)) + Math.abs((h / 2) * Math.sin(angle));
            return ex * 2;
        }
        function getAABBHeight(o) {
            const w = o.getScaledWidth();
            const h = o.getScaledHeight();
            const angle = ((o.angle || 0) * Math.PI) / 180;
            const ey = Math.abs((w / 2) * Math.sin(angle)) + Math.abs((h / 2) * Math.cos(angle));
            return ey * 2;
        }
    }
};