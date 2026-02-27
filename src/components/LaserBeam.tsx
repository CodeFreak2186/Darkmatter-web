"use client"

import { useEffect, useRef } from 'react';

export default function LaserBeam() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = (canvas.width = window.innerWidth);
        let h = (canvas.height = window.innerHeight);
        let animId = 0;
        let hScanY = 0;          // horizontal scanner position
        let vScanX = 0;          // vertical scanner position
        let hSpeed = 0.4;
        let vSpeed = 0.25;
        let hDir = 1;
        let vDir = 1;
        let hAlpha = 0;
        let vAlpha = 0;
        let hPause = 0;
        let vPause = 0;

        const onResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        const draw = () => {
            ctx.clearRect(0, 0, w, h);

            // -- Horizontal scanner (green) --
            if (hPause > 0) {
                hPause--;
                hAlpha *= 0.95;
            } else {
                hScanY += hSpeed * hDir;
                if (hScanY > h) { hDir = -1; hPause = 120; }
                if (hScanY < 0) { hDir = 1; hPause = 120; }
                hAlpha = Math.min(hAlpha + 0.02, 0.6);
            }

            if (hAlpha > 0.01) {
                // Main line
                const hGrad = ctx.createLinearGradient(0, hScanY, w, hScanY);
                hGrad.addColorStop(0, `rgba(182, 255, 46, 0)`);
                hGrad.addColorStop(0.15, `rgba(182, 255, 46, ${hAlpha})`);
                hGrad.addColorStop(0.5, `rgba(182, 255, 46, ${hAlpha})`);
                hGrad.addColorStop(0.85, `rgba(182, 255, 46, ${hAlpha})`);
                hGrad.addColorStop(1, `rgba(182, 255, 46, 0)`);

                ctx.strokeStyle = hGrad;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, hScanY);
                ctx.lineTo(w, hScanY);
                ctx.stroke();

                // Glow
                const glowGrad = ctx.createLinearGradient(0, hScanY - 30, 0, hScanY + 30);
                glowGrad.addColorStop(0, `rgba(182, 255, 46, 0)`);
                glowGrad.addColorStop(0.5, `rgba(182, 255, 46, ${hAlpha * 0.08})`);
                glowGrad.addColorStop(1, `rgba(182, 255, 46, 0)`);
                ctx.fillStyle = glowGrad;
                ctx.fillRect(0, hScanY - 30, w, 60);
            }

            // -- Vertical scanner (red/orange) --
            if (vPause > 0) {
                vPause--;
                vAlpha *= 0.95;
            } else {
                vScanX += vSpeed * vDir;
                if (vScanX > w) { vDir = -1; vPause = 200; }
                if (vScanX < 0) { vDir = 1; vPause = 200; }
                vAlpha = Math.min(vAlpha + 0.015, 0.35);
            }

            if (vAlpha > 0.01) {
                const vGrad = ctx.createLinearGradient(vScanX, 0, vScanX, h);
                vGrad.addColorStop(0, `rgba(255, 60, 60, 0)`);
                vGrad.addColorStop(0.2, `rgba(255, 60, 60, ${vAlpha})`);
                vGrad.addColorStop(0.5, `rgba(255, 60, 60, ${vAlpha})`);
                vGrad.addColorStop(0.8, `rgba(255, 60, 60, ${vAlpha})`);
                vGrad.addColorStop(1, `rgba(255, 60, 60, 0)`);

                ctx.strokeStyle = vGrad;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(vScanX, 0);
                ctx.lineTo(vScanX, h);
                ctx.stroke();

                // Glow
                const vGlowGrad = ctx.createLinearGradient(vScanX - 20, 0, vScanX + 20, 0);
                vGlowGrad.addColorStop(0, `rgba(255, 60, 60, 0)`);
                vGlowGrad.addColorStop(0.5, `rgba(255, 60, 60, ${vAlpha * 0.06})`);
                vGlowGrad.addColorStop(1, `rgba(255, 60, 60, 0)`);
                ctx.fillStyle = vGlowGrad;
                ctx.fillRect(vScanX - 20, 0, 40, h);
            }

            animId = requestAnimationFrame(draw);
        };

        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-[50]"
            style={{ mixBlendMode: 'screen' }}
        />
    );
}
