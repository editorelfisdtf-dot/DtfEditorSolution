const AdvancedPacker = {
    async optimize(canvas, maxWidthCm) {
        const ppi = 37.795;
        const totalWidthPx = 58 * ppi;
        const margin = 1 * ppi;
        const spacing = 12; // ~3mm

        const objects = canvas.getObjects().filter(o => o.type === 'image');

        // RESET: Quitamos transformaciones temporales para medir bien
        const items = objects.map(obj => {
            obj.set({ originX: 'left', originY: 'top' });
            return {
                obj: obj,
                w: obj.width * obj.scaleX,
                h: obj.height * obj.scaleY
            };
        }).sort((a, b) => b.h - a.h);

        const placedItems = [];

        for (const item of items) {
            let placed = false;
            // Empieza estrictamente después del margen superior
            for (let y = margin; y < 200000 && !placed; y += 10) {
                // Empieza estrictamente después del margen izquierdo
                for (let x = margin; x <= (totalWidthPx - margin - item.w) && !placed; x += 10) {
                    let collision = false;
                    for (const p of placedItems) {
                        if (!(x + item.w + spacing < p.x || x > p.x + p.w + spacing ||
                            y + item.h + spacing < p.y || y > p.y + p.h + spacing)) {
                            collision = true; break;
                        }
                    }
                    if (!collision) {
                        item.obj.set({ left: x, top: y }).setCoords();
                        placedItems.push({ x, y, w: item.w, h: item.h });
                        placed = true;
                    }
                }
            }
        }
        canvas.renderAll();
        ajustarLargoDinamico();
    }
};