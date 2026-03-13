"use client"

import { useEffect, useRef } from 'react';

export default function ThreatRadar() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const SIZE = 400;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        const maxR = SIZE / 2 - 20;
        let angle = 0;
        let animId = 0;

        // Random threat dots
        interface Threat {
            angle: number;
            dist: number;
            size: number;
            pulse: number;
            speed: number;
        }
        const threats: Threat[] = [];
        for (let i = 0; i < 12; i++) {
            threats.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * maxR * 0.8 + maxR * 0.1,
                size: Math.random() * 3 + 2,
                pulse: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.002 + 0.001,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, SIZE, SIZE);

            // Concentric rings
            for (let r = 1; r <= 4; r++) {
                const radius = (maxR / 4) * r;
                ctx.strokeStyle = `rgba(182, 255, 46, ${0.08 + r * 0.02})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Cross lines
            ctx.strokeStyle = 'rgba(182, 255, 46, 0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
            ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
            ctx.stroke();

            // Sweep
            angle += 0.015;
            const sweepGrad = ctx.createConicGradient(angle, cx, cy);
            sweepGrad.addColorStop(0, 'rgba(182, 255, 46, 0.15)');
            sweepGrad.addColorStop(0.08, 'rgba(182, 255, 46, 0.02)');
            sweepGrad.addColorStop(0.1, 'rgba(182, 255, 46, 0)');
            sweepGrad.addColorStop(1, 'rgba(182, 255, 46, 0)');

            ctx.fillStyle = sweepGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
            ctx.fill();

            // Sweep line
            const sx = cx + Math.cos(angle) * maxR;
            const sy = cy + Math.sin(angle) * maxR;
            ctx.strokeStyle = 'rgba(182, 255, 46, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Threat dots
            threats.forEach((t) => {
                t.pulse += 0.05;
                t.angle += t.speed;
                const tx = cx + Math.cos(t.angle) * t.dist;
                const ty = cy + Math.sin(t.angle) * t.dist;
                const pulseFactor = 1 + Math.sin(t.pulse) * 0.3;

                // Angle diff from sweep
                let angleDiff = Math.abs(((angle % (Math.PI * 2)) - (t.angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
                const brightness = angleDiff < 0.5 ? 1 : 0.3;

                ctx.fillStyle = `rgba(255, ${brightness > 0.5 ? 100 : 60}, ${brightness > 0.5 ? 100 : 60}, ${brightness * 0.8})`;
                ctx.beginPath();
                ctx.arc(tx, ty, t.size * pulseFactor, 0, Math.PI * 2);
                ctx.fill();

                // Glow
                ctx.fillStyle = `rgba(255, 60, 60, ${brightness * 0.15})`;
                ctx.beginPath();
                ctx.arc(tx, ty, t.size * pulseFactor * 3, 0, Math.PI * 2);
                ctx.fill();
            });

            // Center dot
            ctx.fillStyle = 'rgba(182, 255, 46, 0.8)';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();

            animId = requestAnimationFrame(draw);
        };

        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="mx-auto"
            style={{ width: 400, height: 400 }}
        />
    );
}
