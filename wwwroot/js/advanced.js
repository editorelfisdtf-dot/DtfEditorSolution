// Generación avanzada (packing rectangular mejorado)
(function () {
    const advancedBtn = document.getElementById("advancedBtn");
    const loadingOverlay = window.loadingOverlay;

    if (!advancedBtn) return;

    function showLoading(show) {
        if (!loadingOverlay) return;
        loadingOverlay.classList.toggle("hidden", !show);
    }

    function advancedLayout(canvasWidthPx, marginPx) {
        const rawItems = window.buildItems ? window.buildItems() : [];
        const items = rawItems.slice().sort((a, b) => {
            const sa = Math.max(a.wpx, a.hpx);
            const sb = Math.max(b.wpx, b.hpx);
            return sb - sa;
        });

        if (!items.length) return null;

        let x = 0;
        let y = 0;
        let rowH = 0;
        const positions = [];

        items.forEach(item => {
            if (x + item.wpx > canvasWidthPx) {
                x = 0;
                y += rowH + marginPx;
                rowH = 0;
            }
            positions.push({ item, x, y });
            x += item.wpx + marginPx;
            if (item.hpx > rowH) rowH = item.hpx;
        });

        const usedHeight = y + rowH;
        return { positions, usedHeight };
    }

    async function runAdvancedGeneration() {
        const imagesData = window.imagesData; // <-- usar el array global directamente
        if (!imagesData || !imagesData.length) {
            alert("Primero sube al menos una imagen PNG.");
            return;
        }

        const marginMmInput = window.marginMmInput;
        const pxPerMm = window.pxPerMm;
        const pxPerCm = window.pxPerCm;
        const FIXED_WIDTH_CM = window.FIXED_WIDTH_CM;

        const marginMm = Math.max(4, parseFloat(marginMmInput.value) || 4);
        marginMmInput.value = marginMm;
        const marginPx = marginMm * pxPerMm;
        const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);

        showLoading(true);

        try {
            await new Promise(r => setTimeout(r, 10));

            const layout = advancedLayout(widthPx, marginPx);
            if (!layout) return;

            // Mostrar preview y ocultar manual si estaba activo
            const previewPanel = document.getElementById("previewPanel");
            const manualPanel = document.getElementById("manualPanel");
            if (previewPanel) previewPanel.style.display = "";
            if (manualPanel) manualPanel.style.display = "none";

            if (typeof window.renderLayout === "function") {
                window.renderLayout(layout, widthPx, true);
            }
        } finally {
            showLoading(false);
        }
    }


    advancedBtn.addEventListener("click", () => {
        runAdvancedGeneration();
    });
})();
