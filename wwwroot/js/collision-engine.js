// collision-engine.js - El motor de detección de píxeles
const CollisionEngine = {
    // Genera una máscara de bits para la imagen (simplificada para rendimiento)
    createBitmask: function (imgElement, scale) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Usamos un muestreo (sampling) para que el cálculo sea veloz
        const sampling = 4;
        const w = (imgElement.width * scale) / sampling;
        const h = (imgElement.height * scale) / sampling;

        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);

        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        try {
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const mask = new Uint8Array(canvas.width * canvas.height);

            for (let i = 0; i < data.length; i += 4) {
                // Si el alfa es mayor a 20, lo consideramos parte del diseño (sólido)
                mask[i / 4] = data[i + 3] > 20 ? 1 : 0;
            }

            return {
                mask,
                width: canvas.width,
                height: canvas.height,
                sampling
            };
        } catch (e) {
            console.error("Error al crear máscara de imagen:", e);
            return null;
        }
    },

    // Verifica si dos máscaras de bits se solapan en sus partes sólidas
    hitTest: function (mask1, x1, y1, mask2, x2, y2) {
        // 1. Verificación rápida de rectángulos (AABB)
        if (x1 < x2 + mask2.width && x1 + mask1.width > x2 &&
            y1 < y2 + mask2.height && y1 + mask1.height > y2) {

            // 2. Verificación detallada píxel por píxel en el área de intersección
            const intersectX = Math.max(x1, x2);
            const intersectY = Math.max(y1, y2);
            const endX = Math.min(x1 + mask1.width, x2 + mask2.width);
            const endY = Math.min(y1 + mask1.height, y2 + mask2.height);

            for (let y = intersectY; y < endY; y++) {
                for (let x = intersectX; x < endX; x++) {
                    const idx1 = Math.floor((x - x1) + (y - y1) * mask1.width);
                    const idx2 = Math.floor((x - x2) + (y - y2) * mask2.width);

                    if (mask1.mask[idx1] === 1 && mask2.mask[idx2] === 1) {
                        return true; // Hay colisión real de tinta
                    }
                }
            }
        }
        return false; // No hay choque o están en áreas transparentes
    }
};