const AdvancedPacker = {
    async optimize(canvas, maxWidthCm) {
        const ppi = 37.795;
        const margin = 1 * ppi; // 1cm margin
        const spacing = 12; // spacing between items

        const totalWidthPx = (maxWidthCm || 58) * ppi;
        const usableLeft = margin;
        const usableRight = totalWidthPx - margin;
        const usableWidth = usableRight - usableLeft;

        const objects = canvas.getObjects().filter(o => o.type === 'image');
        if (!objects.length) return;

        // Prepare items with AABB sizes that respect rotation and scaling
        const items = objects.map(obj => {
            // ensure coords updated
            obj.setCoords();
            const w = getAABBWidth(obj);
            const h = getAABBHeight(obj);
            return { obj, w, h };
        }).sort((a, b) => b.h - a.h); // taller first

        // Shelf packing (first-fit): try place in existing shelves, otherwise create new shelf
        const shelves = [];
        const marginY = margin;

        for (const item of items) {
            let placed = false;
            // try existing shelves
            for (const shelf of shelves) {
                const remaining = usableLeft + usableWidth - shelf.xCursor;
                if (remaining >= item.w) {
                    // place in this shelf
                    const centerX = shelf.xCursor + item.w / 2;
                    const centerY = shelf.y + item.h / 2;
                    item.obj.set({ originX: 'center', originY: 'center', left: centerX, top: centerY });
                    item.obj.setCoords();

                    shelf.xCursor += item.w + spacing;
                    shelf.height = Math.max(shelf.height, item.h);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                // create new shelf at current total height
                const y = shelves.length === 0 ? marginY : (Math.max(...shelves.map(s => s.y + s.height)) + spacing);
                const centerX = usableLeft + item.w / 2;
                const centerY = y + item.h / 2;
                item.obj.set({ originX: 'center', originY: 'center', left: centerX, top: centerY });
                item.obj.setCoords();

                shelves.push({ xCursor: usableLeft + item.w + spacing, y: y, height: item.h });
            }
        }

        canvas.renderAll();
        if (typeof ajustarLargoDinamico === 'function') ajustarLargoDinamico();

        // Helpers: compute AABB using scaled dims and angle
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