const AdvancedPacker = {
    async optimize(canvas, maxWidthCm) {
        const ppi = 37.795;
        const totalWidthPx = maxWidthCm * ppi; // use provided maxWidthCm
        const totalHeightPx = 100 * ppi; // fallback virtual height
        const margin = 1 * ppi; // 1cm de margen
        const spacing = 12; // espacio mínimo entre objetos

        const objects = canvas.getObjects().filter(o => o.type === 'image');

        // Preparar items: calcular dimensiones reales después de rotación/escala
        const items = objects.map(obj => {
            // usar origen al centro para facilitar posicionamiento
            obj.set({ originX: 'center', originY: 'center' });
            obj.setCoords();

            // Obtener bounding rect que incluye rotación
            const rect = obj.getBoundingRect(true);

            return {
                obj: obj,
                w: rect.width,
                h: rect.height
            };
        }).sort((a, b) => b.h - a.h); // ordenar por altura (más altos primero)

        const placedItems = []; // lista de rects colocados {x,y,w,h}
        const usableLeft = margin;
        const usableRight = totalWidthPx - margin;
        const usableWidth = usableRight - usableLeft;

        for (const item of items) {
            let placed = false;

            // Intentar colocar el objeto escaneando filas y columnas dentro del ancho utilizable
            const step = Math.max(5, Math.round(Math.min(item.w, item.h) / 8));
            let y = margin;
            const maxScanY = 20 * ppi * 10; // guard para evitar bucle infinito

            while (!placed && y < maxScanY) {
                for (let x = usableLeft; x <= usableLeft + usableWidth - item.w; x += step) {
                    // Primero comprobar límites X
                    if (x + item.w > usableRight) continue;

                    // comprobar colisiones con separación
                    let collision = false;
                    for (const p of placedItems) {
                        if (!(x + item.w + spacing <= p.x ||
                              x >= p.x + p.w + spacing ||
                              y + item.h + spacing <= p.y ||
                              y >= p.y + p.h + spacing)) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        // Colocar objeto (recordar que el origen es el centro)
                        const centerX = x + (item.w / 2);
                        const centerY = y + (item.h / 2);

                        item.obj.set({ left: centerX, top: centerY }).setCoords();

                        placedItems.push({ x: x, y: y, w: item.w, h: item.h });
                        placed = true;
                        break;
                    }
                }

                if (!placed) y += step;
            }

            if (!placed) {
                // fallback: colocar debajo del último elemento
                const lastY = placedItems.length > 0 ? Math.max(...placedItems.map(p => p.y + p.h)) + spacing : margin;
                const x = usableLeft;
                const centerX = x + (item.w / 2);
                const centerY = lastY + (item.h / 2);

                item.obj.set({ left: centerX, top: centerY }).setCoords();
                placedItems.push({ x: x, y: lastY, w: item.w, h: item.h });
            }
        }

        // Después de colocar todo, renderizar y ajustar largo dinámico
        canvas.renderAll();
        if (typeof ajustarLargoDinamico === 'function') ajustarLargoDinamico();
    }
};