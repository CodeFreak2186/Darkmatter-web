"use client"

import { useEffect, useRef } from 'react';

export default function GridBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const CELL = 40;
        const MOUSE_RADIUS = 300;
        const mouse = { x: width / 2, y: height / 2 };

        let columns = Math.floor(width / CELL);
        let rows = Math.floor(height / CELL);

        interface Point {
            x: number; y: number;
            opacity: number; targetOpacity: number;
        }

        let points: Point[] = [];

        const initPoints = () => {
            points = [];
            columns = Math.floor(width / CELL);
            rows = Math.floor(height / CELL);
            for (let x = 0; x <= columns; x++) {
                for (let y = 0; y <= rows; y++) {
                    points.push({
                        x: x * CELL,
                        y: y * CELL,
                        opacity: Math.random() * 0.5,
                        targetOpacity: Math.random() * 0.5,
                    });
                }
            }
        };

        initPoints();

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', onMouseMove);

        let animId = 0;

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            // ── Grid lines — brighten near mouse ──
            for (let x = 0; x <= columns; x++) {
                const gx = x * CELL;
                const distToMouse = Math.abs(gx - mouse.x);
                const mouseEffect = Math.max(0, 1 - distToMouse / MOUSE_RADIUS);
                const baseAlpha = 0.04;
                const alpha = baseAlpha + mouseEffect * 0.08;

                ctx.strokeStyle = mouseEffect > 0
                    ? `rgba(182, 255, 46, ${alpha})`
                    : `rgba(255, 255, 255, ${baseAlpha})`;
                ctx.lineWidth = mouseEffect > 0.3 ? 1 : 0.5;
                ctx.beginPath();
                ctx.moveTo(gx, 0);
                ctx.lineTo(gx, height);
                ctx.stroke();
            }

            for (let y = 0; y <= rows; y++) {
                const gy = y * CELL;
                const distToMouse = Math.abs(gy - mouse.y);
                const mouseEffect = Math.max(0, 1 - distToMouse / MOUSE_RADIUS);
                const baseAlpha = 0.04;
                const alpha = baseAlpha + mouseEffect * 0.08;

                ctx.strokeStyle = mouseEffect > 0
                    ? `rgba(182, 255, 46, ${alpha})`
                    : `rgba(255, 255, 255, ${baseAlpha})`;
                ctx.lineWidth = mouseEffect > 0.3 ? 1 : 0.5;
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(width, gy);
                ctx.stroke();
            }

            // ── Intersection points — glow near cursor ──
            points.forEach(point => {
                // Random flicker
                if (Math.random() > 0.99) {
                    point.targetOpacity = Math.random() * 0.8;
                }
                point.opacity += (point.targetOpacity - point.opacity) * 0.05;

                const dx = point.x - mouse.x;
                const dy = point.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const mouseEffect = Math.max(0, 1 - dist / MOUSE_RADIUS);

                // Base dot
                const baseOpacity = point.opacity > 0.1 ? point.opacity : 0;
                const totalOpacity = Math.min(1, baseOpacity + mouseEffect * 1.2);
                const size = 1 + mouseEffect * 4;

                if (totalOpacity > 0.05) {
                    // Outer glow for mouse-near points
                    if (mouseEffect > 0.2) {
                        const glowSize = size * 4;
                        const glowAlpha = mouseEffect * 0.15;
                        ctx.fillStyle = `rgba(182, 255, 46, ${glowAlpha})`;
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, glowSize, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Core dot
                    ctx.fillStyle = mouseEffect > 0
                        ? `rgba(182, 255, 46, ${totalOpacity})`
                        : `rgba(182, 255, 46, ${baseOpacity})`;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // ── Highlight nearest grid cell ──
            const cellX = Math.round(mouse.x / CELL) * CELL;
            const cellY = Math.round(mouse.y / CELL) * CELL;
            ctx.strokeStyle = 'rgba(182, 255, 46, 0.12)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX - CELL / 2, cellY - CELL / 2, CELL, CELL);

            animId = requestAnimationFrame(animate);
        };

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initPoints();
        };

        window.addEventListener('resize', handleResize);
        animId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-0 opacity-60"
        />
    );
}
