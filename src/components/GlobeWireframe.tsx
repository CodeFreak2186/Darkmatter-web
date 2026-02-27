"use client"

import { useEffect, useRef } from 'react';

/**
 * Renders a 3D wireframe globe that rotates.
 * Uses only canvas2d — no Three.js dependency.
 */
export default function GlobeWireframe() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const SIZE = 360;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        const R = SIZE / 2 - 30;
        let rotY = 0;
        let animId = 0;

        const project = (lat: number, lon: number): [number, number, number] => {
            const φ = (lat * Math.PI) / 180;
            const λ = ((lon + rotY) * Math.PI) / 180;
            const x = R * Math.cos(φ) * Math.sin(λ);
            const y = R * Math.sin(φ);
            const z = R * Math.cos(φ) * Math.cos(λ);
            return [cx + x, cy - y, z];
        };

        const draw = () => {
            ctx.clearRect(0, 0, SIZE, SIZE);
            rotY += 0.3;

            // Outer circle
            ctx.strokeStyle = 'rgba(182, 255, 46, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();

            // Latitude lines
            for (let lat = -60; lat <= 60; lat += 30) {
                ctx.strokeStyle = 'rgba(182, 255, 46, 0.08)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                let started = false;
                for (let lon = 0; lon <= 360; lon += 5) {
                    const [px, py, pz] = project(lat, lon);
                    if (pz > 0) {
                        if (!started) { ctx.moveTo(px, py); started = true; }
                        else ctx.lineTo(px, py);
                    } else {
                        started = false;
                    }
                }
                ctx.stroke();
            }

            // Longitude lines
            for (let lon = 0; lon < 360; lon += 30) {
                ctx.strokeStyle = 'rgba(182, 255, 46, 0.08)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                let started = false;
                for (let lat = -90; lat <= 90; lat += 5) {
                    const [px, py, pz] = project(lat, lon);
                    if (pz > 0) {
                        if (!started) { ctx.moveTo(px, py); started = true; }
                        else ctx.lineTo(px, py);
                    } else {
                        started = false;
                    }
                }
                ctx.stroke();
            }

            // Random "data points" on globe surface
            const dataPoints = [
                [40, -74], [51, 0], [35, 139], [-33, 151], [55, 37],
                [1, 103], [48, 2], [37, -122], [-23, -43], [28, 77],
                [30, 31], [-1, 36], [22, 114], [34, -118],
            ];

            dataPoints.forEach(([lat, lon]) => {
                const [px, py, pz] = project(lat, lon);
                if (pz > 0) {
                    const alpha = 0.4 + (pz / R) * 0.6;
                    // Dot
                    ctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Glow
                    ctx.fillStyle = `rgba(255, 80, 80, ${alpha * 0.15})`;
                    ctx.beginPath();
                    ctx.arc(px, py, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            animId = requestAnimationFrame(draw);
        };

        animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="mx-auto"
            style={{ width: 360, height: 360 }}
        />
    );
}
