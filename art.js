(function () {
    function seeded(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function grain(ctx, w, h, amount, rand) {
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (rand() - 0.5) * amount;
            d[i] += n;
            d[i + 1] += n;
            d[i + 2] += n;
        }
        ctx.putImageData(img, 0, 0);
    }

    function vignette(ctx, w, h, strength) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    function skyline(canvas) {
        const W = (canvas.width = 1920);
        const H = (canvas.height = 1080);
        const c = canvas.getContext('2d');
        const rand = seeded(7);

        let g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, '#080504');
        g.addColorStop(0.55, '#1b120c');
        g.addColorStop(1, '#0b0705');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        g = c.createRadialGradient(W * 0.5, H * 0.58, 20, W * 0.5, H * 0.58, W * 0.42);
        g.addColorStop(0, 'rgba(200,125,62,.34)');
        g.addColorStop(0.5, 'rgba(160,95,45,.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        const wx = W * 0.56;
        const wy = H * 0.07;
        const ww = W * 0.44;
        const wh = H * 0.84;

        c.save();
        c.beginPath();
        c.rect(wx, wy, ww, wh);
        c.clip();

        g = c.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, '#030913');
        g.addColorStop(0.42, '#0b1b38');
        g.addColorStop(0.72, '#2c3150');
        g.addColorStop(0.9, '#6a4c40');
        g.addColorStop(1, '#8a6246');
        c.fillStyle = g;
        c.fillRect(wx, wy, ww, wh);

        for (let i = 0; i < 90; i++) {
            c.fillStyle = 'rgba(255,255,255,' + (0.15 + rand() * 0.5) + ')';
            c.fillRect(wx + rand() * ww, wy + rand() * wh * 0.38, 1.4, 1.4);
        }

        const horizon = wy + wh * 0.86;

        function layer(color, minW, maxW, minH, maxH, density, lift) {
            let x = wx - 40;
            while (x < wx + ww + 40) {
                const bw = minW + rand() * (maxW - minW);
                const bh = minH + rand() * (maxH - minH);
                const top = horizon - bh - lift;
                c.fillStyle = color;
                c.fillRect(x, top, bw, bh + lift + 60);
                const cols = Math.max(1, Math.floor(bw / 11));
                const rows = Math.floor(bh / 15);
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        if (rand() < density) {
                            const warm = rand() < 0.75 ? '#ffd596' : '#fff2d4';
                            c.fillStyle = warm;
                            c.globalAlpha = 0.35 + rand() * 0.65;
                            c.fillRect(x + 4 + i * 11, top + 8 + j * 15, 4, 6);
                            c.globalAlpha = 1;
                        }
                    }
                }
                x += bw + rand() * 3;
            }
        }

        layer('#162238', 26, 70, 40, 150, 0.2, 0);
        layer('#0c1424', 30, 84, 60, 250, 0.3, -20);

        const sx = wx + ww * 0.5;
        c.fillStyle = '#080d18';
        c.fillRect(sx - 50, horizon - 400, 100, 500);
        c.fillRect(sx - 36, horizon - 470, 72, 80);
        c.fillRect(sx - 22, horizon - 530, 44, 70);
        c.beginPath();
        c.moveTo(sx - 13, horizon - 530);
        c.lineTo(sx, horizon - 600);
        c.lineTo(sx + 13, horizon - 530);
        c.fill();
        c.fillRect(sx - 2, horizon - 720, 4, 130);
        for (let j = 0; j < 20; j++) {
            for (let i = 0; i < 6; i++) {
                if (rand() < 0.62) {
                    c.fillStyle = rand() < 0.8 ? 'rgba(255,214,150,.9)' : 'rgba(255,244,214,.95)';
                    c.fillRect(sx - 44 + i * 15, horizon - 385 + j * 20, 6, 9);
                }
            }
        }
        for (let j = 0; j < 3; j++) {
            c.fillStyle = 'rgba(255,214,150,.95)';
            c.fillRect(sx - 30 + j * 24, horizon - 455, 8, 12);
            c.fillRect(sx - 14 + j * 12, horizon - 515, 5, 9);
        }
        g = c.createRadialGradient(sx, horizon - 470, 6, sx, horizon - 470, 150);
        g.addColorStop(0, 'rgba(255,214,150,.42)');
        g.addColorStop(1, 'rgba(255,214,150,0)');
        c.fillStyle = g;
        c.fillRect(sx - 160, horizon - 640, 320, 340);
        c.fillStyle = 'rgba(255,120,90,.9)';
        c.fillRect(sx - 3, horizon - 724, 6, 6);

        layer('#05080f', 40, 120, 80, 300, 0.22, -70);

        g = c.createLinearGradient(0, horizon, 0, wy + wh);
        g.addColorStop(0, 'rgba(255,170,90,.0)');
        g.addColorStop(0.5, 'rgba(255,170,90,.14)');
        g.addColorStop(1, 'rgba(20,10,5,.7)');
        c.fillStyle = g;
        c.fillRect(wx, horizon, ww, wy + wh - horizon);

        c.restore();

        const frame = c.createLinearGradient(0, 0, 0, H);
        frame.addColorStop(0, '#3a2a1e');
        frame.addColorStop(1, '#17100b');
        c.fillStyle = frame;
        c.fillRect(wx - 46, wy - 46, ww + 46, 46);
        c.fillRect(wx - 46, wy, 46, wh + 46);
        c.fillRect(wx - 46, wy + wh, ww + 46, 70);
        c.fillStyle = 'rgba(210,150,90,.35)';
        c.fillRect(wx - 6, wy, 3, wh);
        c.fillRect(wx, wy + wh, ww, 3);
        [0.36, 0.78].forEach(function (f) {
            const mx = wx + ww * f;
            const mg = c.createLinearGradient(mx - 5, 0, mx + 5, 0);
            mg.addColorStop(0, '#1a110b');
            mg.addColorStop(0.5, '#3c2c20');
            mg.addColorStop(1, '#120b07');
            c.fillStyle = mg;
            c.fillRect(mx - 5, wy, 10, wh);
        });

        const lightFloor = c.createLinearGradient(wx - 600, H * 0.8, wx, H);
        lightFloor.addColorStop(0, 'rgba(0,0,0,0)');
        lightFloor.addColorStop(1, 'rgba(220,150,80,.12)');
        c.fillStyle = lightFloor;
        c.fillRect(0, H * 0.8, wx, H * 0.2);

        vignette(c, W, H, 0.55);
        grain(c, W, H, 14, rand);
    }

    function hall(canvas) {
        const W = (canvas.width = 1920);
        const H = (canvas.height = 1080);
        const c = canvas.getContext('2d');
        const rand = seeded(21);

        let g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#060403');
        g.addColorStop(0.5, '#120b07');
        g.addColorStop(1, '#241810');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        c.strokeStyle = 'rgba(160,110,70,.10)';
        c.lineWidth = 2;
        for (let i = 0; i <= 14; i++) {
            const x = (W / 14) * i;
            c.beginPath();
            c.moveTo(W / 2 + (x - W / 2) * 0.4, H * 0.06);
            c.lineTo(x, 0);
            c.stroke();
        }
        for (let j = 1; j < 5; j++) {
            c.beginPath();
            c.moveTo(W * 0.2, H * 0.06 + j * 14);
            c.lineTo(W * 0.8, H * 0.06 + j * 14);
            c.stroke();
        }

        g = c.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, W * 0.22);
        g.addColorStop(0, 'rgba(255,200,130,.42)');
        g.addColorStop(1, 'rgba(255,200,130,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        c.fillStyle = '#0b0705';
        c.beginPath();
        c.moveTo(W * 0.445, H * 0.62);
        c.lineTo(W * 0.445, H * 0.36);
        c.quadraticCurveTo(W * 0.5, H * 0.2, W * 0.555, H * 0.36);
        c.lineTo(W * 0.555, H * 0.62);
        c.fill();
        g = c.createLinearGradient(0, H * 0.25, 0, H * 0.62);
        g.addColorStop(0, 'rgba(255,214,150,.55)');
        g.addColorStop(1, 'rgba(255,214,150,.08)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(W * 0.455, H * 0.62);
        c.lineTo(W * 0.455, H * 0.37);
        c.quadraticCurveTo(W * 0.5, H * 0.24, W * 0.545, H * 0.37);
        c.lineTo(W * 0.545, H * 0.62);
        c.fill();
        c.fillStyle = '#0b0705';
        c.fillRect(W * 0.498, H * 0.26, 5, H * 0.36);
        c.fillRect(W * 0.455, H * 0.46, W * 0.09, 5);

        function column(x, w, y0, y1, side) {
            const cg = c.createLinearGradient(x, 0, x + w, 0);
            if (side === 'l') {
                cg.addColorStop(0, '#0a0604');
                cg.addColorStop(0.7, '#2b1d13');
                cg.addColorStop(1, '#4a3321');
            } else {
                cg.addColorStop(0, '#4a3321');
                cg.addColorStop(0.3, '#2b1d13');
                cg.addColorStop(1, '#0a0604');
            }
            c.fillStyle = cg;
            c.fillRect(x, y0, w, y1 - y0);
            c.fillStyle = 'rgba(0,0,0,.45)';
            for (let i = 1; i < 5; i++) c.fillRect(x + (w / 5) * i, y0, 2, y1 - y0);
        }
        column(W * 0.05, W * 0.09, 0, H * 0.7, 'l');
        column(W * 0.2, W * 0.055, H * 0.04, H * 0.66, 'l');
        column(W * 0.31, W * 0.035, H * 0.1, H * 0.64, 'l');
        column(W * 0.86, W * 0.09, 0, H * 0.7, 'r');
        column(W * 0.745, W * 0.055, H * 0.04, H * 0.66, 'r');
        column(W * 0.655, W * 0.035, H * 0.1, H * 0.64, 'r');

        const floorTop = H * 0.62;
        g = c.createLinearGradient(0, floorTop, 0, H);
        g.addColorStop(0, '#1b120c');
        g.addColorStop(1, '#3c2b1d');
        c.fillStyle = g;
        c.fillRect(0, floorTop, W, H - floorTop);

        c.strokeStyle = 'rgba(0,0,0,.45)';
        c.lineWidth = 3;
        for (let i = -6; i <= 6; i++) {
            c.beginPath();
            c.moveTo(W / 2 + i * 26, floorTop);
            c.lineTo(W / 2 + i * 340, H);
            c.stroke();
        }
        for (let j = 0; j < 6; j++) {
            const y = floorTop + Math.pow(j / 6, 1.8) * (H - floorTop);
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(W, y);
            c.stroke();
        }
        c.fillStyle = 'rgba(8,4,2,.78)';
        c.beginPath();
        c.moveTo(W * 0.46, floorTop);
        c.lineTo(W * 0.54, floorTop);
        c.lineTo(W * 0.74, H);
        c.lineTo(W * 0.26, H);
        c.fill();

        [[0.1, 0.8], [0.34, 0.52], [0.62, 0.34]].forEach(function (b) {
            c.fillStyle = 'rgba(255,190,120,.17)';
            c.beginPath();
            c.moveTo(W * b[0], floorTop + 6);
            c.lineTo(W * (b[0] + 0.1), floorTop + 6);
            c.lineTo(W * (b[0] + 0.1 + b[1] * 0.18), H);
            c.lineTo(W * (b[0] + b[1] * 0.18), H);
            c.fill();
        });

        for (let i = 0; i < 160; i++) {
            c.strokeStyle = 'rgba(255,230,190,' + rand() * 0.05 + ')';
            c.lineWidth = 1;
            const x = rand() * W;
            const y = floorTop + rand() * (H - floorTop);
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + rand() * 160 - 80, y + rand() * 14);
            c.stroke();
        }

        const lx = W * 0.62;
        const ly = H * 0.8;
        g = c.createRadialGradient(lx, ly, 4, lx, ly, 280);
        g.addColorStop(0, 'rgba(255,200,120,.55)');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = g;
        c.fillRect(lx - 300, ly - 300, 600, 600);
        c.fillStyle = '#6b4a2a';
        c.beginPath();
        c.ellipse(lx, ly - 10, 62, 28, 0, Math.PI, 0);
        c.fill();
        c.fillStyle = '#2a1a0f';
        c.fillRect(lx - 5, ly - 8, 10, 110);
        c.fillRect(lx - 34, ly + 100, 68, 10);

        vignette(c, W, H, 0.6);
        grain(c, W, H, 14, rand);
    }

    function medallion(canvas, kind) {
        const S = (canvas.width = canvas.height = 420);
        const c = canvas.getContext('2d');
        const rand = seeded(kind.length * 31 + 5);
        let g = c.createLinearGradient(0, 0, S, S);
        g.addColorStop(0, '#2c2c2b');
        g.addColorStop(1, '#0d0d0d');
        c.fillStyle = g;
        c.fillRect(0, 0, S, S);

        if (kind === 'arch') {
            g = c.createRadialGradient(S * 0.5, S * 0.55, 10, S * 0.5, S * 0.55, S * 0.55);
            g.addColorStop(0, 'rgba(255,255,255,.9)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, S, S);
            c.fillStyle = '#0c0c0c';
            c.beginPath();
            c.moveTo(S * 0.22, S);
            c.lineTo(S * 0.22, S * 0.45);
            c.arc(S * 0.5, S * 0.45, S * 0.28, Math.PI, 0);
            c.lineTo(S * 0.78, S);
            c.lineTo(S * 0.68, S);
            c.lineTo(S * 0.68, S * 0.46);
            c.arc(S * 0.5, S * 0.46, S * 0.18, 0, Math.PI, true);
            c.lineTo(S * 0.32, S);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,.28)';
            c.beginPath();
            c.moveTo(S * 0.32, S);
            c.lineTo(S * 0.68, S);
            c.lineTo(S * 0.92, S);
            c.lineTo(S * 0.08, S);
            c.fill();
        } else if (kind === 'stairs') {
            for (let i = 0; i < 9; i++) {
                const y = S * 0.3 + i * (S * 0.085);
                const x0 = S * 0.12 + i * 8;
                c.fillStyle = 'rgba(255,255,255,' + (0.1 + i * 0.07) + ')';
                c.fillRect(x0, y, S - x0 * 1.4, S * 0.05);
                c.fillStyle = 'rgba(0,0,0,.6)';
                c.fillRect(x0, y + S * 0.05, S - x0 * 1.4, S * 0.035);
            }
            g = c.createLinearGradient(0, 0, S, 0);
            g.addColorStop(0, 'rgba(255,255,255,.35)');
            g.addColorStop(0.4, 'rgba(255,255,255,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, S, S * 0.5);
        } else {
            const cols = 5;
            for (let i = 0; i < cols; i++) {
                const x = S * 0.1 + i * (S * 0.16);
                c.fillStyle = 'rgba(255,255,255,' + (0.1 + rand() * 0.75) + ')';
                c.fillRect(x, S * 0.12, S * 0.11, S * 0.76);
                c.fillStyle = '#0c0c0c';
                c.fillRect(x, S * 0.12 + S * 0.3, S * 0.11, 4);
                c.fillRect(x + S * 0.052, S * 0.12, 3, S * 0.76);
            }
        }
        vignette(c, S, S, 0.6);
        grain(c, S, S, 22, rand);
    }

    window.Art = { skyline: skyline, hall: hall, medallion: medallion };
})();
