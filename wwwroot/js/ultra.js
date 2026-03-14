// Generación ultra (alpha-aware + rotación libre discreta + solapamiento parcial)
(function () {
    const ultraBtn = document.getElementById("ultraBtn");
    const loadingOverlay = window.loadingOverlay;

    if (!ultraBtn) return;

    function showLoading(show) {
        if (!loadingOverlay) return;
        loadingOverlay.classList.toggle("hidden", !show);
    }

    function getItemsWithAlpha() {
        const raw = window.buildItems ? window.buildItems() : [];
        // cada item ya trae data.mask, maskWidth, maskHeight
        return raw.filter(it => it.data && it.data.mask);
    }

    function computeAABB(cx, cy, w, h, angle) {
        const hw = w / 2;
        const hh = h / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const ex = Math.abs(hw * cos) + Math.abs(hh * sin);
        const ey = Math.abs(hw * sin) + Math.abs(hh * cos);
        return {
            minX: cx - ex,
            maxX: cx + ex,
            minY: cy - ey,
            maxY: cy + ey
        };
    }

    function alphaAt(sprite, gx, gy) {
        const { data, scale, baseWpx, baseHpx, angle, cx, cy } = sprite;
        const mask = data.mask;
        const mw = data.maskWidth;
        const mh = data.maskHeight;

        const dx = gx - cx;
        const dy = gy - cy;

        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        const w = baseWpx * scale;
        const h = baseHpx * scale;

        const u = (lx + w / 2) / scale;
        const v = (ly + h / 2) / scale;

        const ix = Math.floor(u);
        const iy = Math.floor(v);

        if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) {
            return 0;
        }
        const idx = iy * mw + ix;
        return mask[idx]; // 0 o 1
    }

    function spritesCollideAlpha(s1, s2, step) {
        const aabb1 = computeAABB(s1.cx, s1.cy, s1.baseWpx * s1.scale, s1.baseHpx * s1.scale, s1.angle);
        const aabb2 = computeAABB(s2.cx, s2.cy, s2.baseWpx * s2.scale, s2.baseHpx * s2.scale, s2.angle);

        const minX = Math.max(aabb1.minX, aabb2.minX);
        const maxX = Math.min(aabb1.maxX, aabb2.maxX);
        const minY = Math.max(aabb1.minY, aabb2.minY);
        const maxY = Math.min(aabb1.maxY, aabb2.maxY);

        if (minX >= maxX || minY >= maxY) {
            return false;
        }

        for (let y = minY; y <= maxY; y += step) {
            for (let x = minX; x <= maxX; x += step) {
                const a1 = alphaAt(s1, x, y);
                if (!a1) continue;
                const a2 = alphaAt(s2, x, y);
                if (!a2) continue;
                return true; // pixel donde ambos tienen alfa
            }
        }
        return false;
    }

    function ultraLayout(canvasWidthPx, marginPx) {
        const baseItems = getItemsWithAlpha();
        if (!baseItems.length) return null;

        const items = baseItems.slice().sort((a, b) => {
            const sa = Math.max(a.wpx, a.hpx);
            const sb = Math.max(b.wpx, b.hpx);
            return sb - sa;
        });

        const placed = [];
        const placements = [];

        const angleStepDeg = 15; // puedes bajar a 10 o 5 si quieres más ángulos
        const candidateAngles = [];
        for (let d = 0; d < 360; d += angleStepDeg) {
            candidateAngles.push(d * Math.PI / 180);
        }

        const step = Math.max(3, marginPx / 2);

        items.forEach(item => {
            const baseWpx = item.baseWpx;
            const baseHpx = item.baseHpx;
            const scale = item.scale;

            let placedThis = false;

            outerLoop:
            for (const angle of candidateAngles) {
                const w = baseWpx * scale;
                const h = baseHpx * scale;

                // escaneo vertical
                let y = 0;
                while (y < canvasWidthPx * 10 && !placedThis) {
                    for (let x = 0; x + w <= canvasWidthPx; x += step) {
                        const cx = x + w / 2;
                        const cy = y + h / 2;

                        const candidateSprite = {
                            data: item.data,
                            baseWpx,
                            baseHpx,
                            scale,
                            angle,
                            cx,
                            cy
                        };

                        let collides = false;
                        for (const other of placed) {
                            if (spritesCollideAlpha(candidateSprite, other, step)) {
                                collides = true;
                                break;
                            }
                        }

                        if (!collides) {
                            placed.push(candidateSprite);
                            placements.push({
                                item,
                                x: cx - w / 2,
                                y: cy - h / 2,
                                angle
                            });
                            placedThis = true;
                            break outerLoop;
                        }
                    }
                    y += step;
                }
            }

            // fallback simple si no lo pudo colocar con overlap alpha
            if (!placedThis) {
                let x = marginPx;
                let y = marginPx;
                const w = item.wpx;
                const h = item.hpx;
                if (placements.length) {
                    // colocar debajo de todo lo que existe
                    let maxY = 0;
                    placements.forEach(p => {
                        const bottom = p.y + p.item.hpx;
                        if (bottom > maxY) maxY = bottom;
                    });
                    y = maxY + marginPx;
                }
                placements.push({
                    item,
                    x,
                    y,
                    angle: item.rotate90 ? Math.PI / 2 : 0
                });
            }
        });

        // calcular altura usada
        let usedHeight = 0;
        placements.forEach(p => {
            const w = p.item.baseWpx * p.item.scale;
            const h = p.item.baseHpx * p.item.scale;
            const aabb = computeAABB(
                p.x + w / 2,
                p.y + h / 2,
                w,
                h,
                p.angle
            );
            if (aabb.maxY > usedHeight) usedHeight = aabb.maxY;
        });

        // adaptar structure a la que espera renderLayout
        const positions = placements.map(p => ({
            item: {
                data: p.item.data,
                wpx: p.item.wpx,
                hpx: p.item.hpx,
                baseWpx: p.item.baseWpx,
                baseHpx: p.item.baseHpx,
                scale: p.item.scale,
                rotate90: false, // ignoramos rotate90 original, usamos angle libre
                _angleOverride: p.angle
            },
            x: p.x,
            y: p.y
        }));

        return { positions, usedHeight };
    }

    async function runUltraGeneration() {
        //const imagesData = window.imagesDataRef ? window.imagesDataRef() : null;
        const imagesData = window.imagesData;
        if (!imagesData || !imagesData.length) {
            alert("Primero sube al menos una imagen PNG.");
            return;
        }

        // salir de modo manual y mostrar vista previa
        if (window.exitManualIfNeeded) {
            window.exitManualIfNeeded("ultra");
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

            const layout = ultraLayout(widthPx, marginPx);
            if (!layout) {
                alert("No se pudo generar layout ultra.");
                return;
            }

            // usamos un render especial que respeta _angleOverride
            const rulerHeight = 60;
            const totalHeight = layout.usedHeight + rulerHeight;

            const previewCanvas = document.getElementById("previewCanvas");
            const previewCtx = previewCanvas.getContext("2d");
            previewCanvas.width = widthPx;
            previewCanvas.height = totalHeight;

            previewCtx.clearRect(0, 0, widthPx, totalHeight);

            // regla
            if (typeof drawRuler === "function") {
                drawRuler(previewCtx, widthPx, rulerHeight, pxPerCm);
            }

            layout.positions.forEach(p => {
                const it = p.item;
                const angle = it._angleOverride ?? 0;
                const w = it.baseWpx * it.scale;
                const h = it.baseHpx * it.scale;

                previewCtx.save();
                previewCtx.translate(p.x + w / 2, p.y + h / 2 + rulerHeight);
                previewCtx.rotate(angle);
                previewCtx.drawImage(it.data.img, -w / 2, -h / 2, w, h);
                previewCtx.restore();
            });

            // actualizar info de largo y precio usando misma lógica que app.js
            const lengthCm = layout.usedHeight / pxPerCm;
            const lengthInfo = document.getElementById("lengthInfo");
            const priceInfo = document.getElementById("priceInfo");
            const currentPrice = window.currentPricePerMeter || 10000;

            if (lengthInfo) {
                lengthInfo.textContent = lengthCm.toFixed(1) + " cm";
            }
            const meters = lengthCm / 100;
            const totalPrice = meters * (window.currentPricePerMeter || 10000);
            if (priceInfo) {
                priceInfo.textContent = totalPrice.toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP"
                });
            }

            // guardar lastLayout compatible para el botón Descargar
            window.lastLayout = {
                positions: layout.positions.map(p => ({
                    item: {
                        data: p.item.data,
                        wpx: p.item.baseWpx * p.item.scale,
                        hpx: p.item.baseHpx * p.item.scale,
                        baseWpx: p.item.baseWpx,
                        baseHpx: p.item.baseHpx,
                        scale: p.item.scale,
                        rotate90: false,
                        _angleOverride: p.item._angleOverride
                    },
                    x: p.x,
                    y: p.y
                })),
                usedHeight: layout.usedHeight
            };

            // marcar modo ultra para que descarga respete ángulos
            if (window.setMode) {
                window.setMode("ultra");
            }
            const downloadBtn = document.getElementById("downloadBtn");
            if (downloadBtn) downloadBtn.disabled = false;
        } finally {
            showLoading(false);
        }
    }

  


    // Sobrescribimos descarga para modo ultra leyendo _angleOverride
    const originalDownload = window.downloadAutoLike;
    window.downloadAutoLike = function () {
        const mode = window.currentModeRef ? window.currentModeRef() : "auto";
        if (mode !== "ultra" || !window.lastLayout) {
            return originalDownload ? originalDownload() : undefined;
        }

        const pxPerCm = window.pxPerCm;
        const FIXED_WIDTH_CM = window.FIXED_WIDTH_CM;
        const widthPx = Math.round(FIXED_WIDTH_CM * pxPerCm);
        const heightPx = window.lastLayout.usedHeight;

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = widthPx;
        exportCanvas.height = heightPx;
        const ectx = exportCanvas.getContext("2d");

        window.lastLayout.positions.forEach(p => {
            const it = p.item;
            const angle = it._angleOverride ?? 0;
            const w = it.baseWpx * it.scale;
            const h = it.baseHpx * it.scale;

            ectx.save();
            ectx.translate(p.x + w / 2, p.y + h / 2);
            ectx.rotate(angle);
            ectx.drawImage(it.data.img, -w / 2, -h / 2, w, h);
            ectx.restore();
        });

        const link = document.createElement("a");
        link.download = "mesa-dtf-ultra-57cm.png";
        link.href = exportCanvas.toDataURL("image/png");
        link.click();
    };

    ultraBtn.addEventListener("click", () => {
        runUltraGeneration();
    });
})();
