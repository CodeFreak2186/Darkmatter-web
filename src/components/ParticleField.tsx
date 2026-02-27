"use client"

import { useEffect, useRef } from 'react';

export default function ParticleField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = (canvas.width = window.innerWidth);
        let h = (canvas.height = window.innerHeight);
        let animId = 0;
        const mouse = { x: w / 2, y: h / 2 };

        interface Node {
            x: number; y: number;
            vx: number; vy: number;
            radius: number;
            baseRadius: number;
        }

        const COUNT = 140;
        const CONNECTION_DIST = 180;
        const MOUSE_DIST = 350;
        const MOUSE_ATTRACT_DIST = 500;
        const nodes: Node[] = [];

        // Trail points for mouse cursor
        const trail: { x: number; y: number; age: number }[] = [];
        const MAX_TRAIL = 30;

        for (let i = 0; i < COUNT; i++) {
            const r = Math.random() * 2.5 + 0.5;
            nodes.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: r,
                baseRadius: r,
            });
        }

        const onResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            // Add trail point on every move
            trail.push({ x: e.clientX, y: e.clientY, age: 0 });
            if (trail.length > MAX_TRAIL) trail.shift();
        };

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);

        const draw = () => {
            ctx.clearRect(0, 0, w, h);

            // ── Mouse glow aura ──
            const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_DIST);
            gradient.addColorStop(0, 'rgba(182, 255, 46, 0.06)');
            gradient.addColorStop(0.3, 'rgba(182, 255, 46, 0.025)');
            gradient.addColorStop(0.6, 'rgba(74, 246, 38, 0.01)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, MOUSE_DIST, 0, Math.PI * 2);
            ctx.fill();

            // ── Mouse trail ──
            for (let t = trail.length - 1; t >= 0; t--) {
                trail[t].age++;
                if (trail[t].age > 40) {
                    trail.splice(t, 1);
                    continue;
                }
                const alpha = (1 - trail[t].age / 40) * 0.15;
                const size = (1 - trail[t].age / 40) * 6;
                ctx.fillStyle = `rgba(182, 255, 46, ${alpha})`;
                ctx.beginPath();
                ctx.arc(trail[t].x, trail[t].y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // ── Connect trail points ──
            if (trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                for (let t = 1; t < trail.length; t++) {
                    ctx.lineTo(trail[t].x, trail[t].y);
                }
                ctx.strokeStyle = 'rgba(182, 255, 46, 0.08)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // ── Particles ──
            for (let i = 0; i < COUNT; i++) {
                const n = nodes[i];
                n.x += n.vx;
                n.y += n.vy;

                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;

                const dx = n.x - mouse.x;
                const dy = n.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Mouse repulsion — much stronger
                if (dist < MOUSE_DIST && dist > 0) {
                    const force = ((MOUSE_DIST - dist) / MOUSE_DIST) * 0.08;
                    n.vx += (dx / dist) * force;
                    n.vy += (dy / dist) * force;
                }

                // Gentle attraction from further away — creates swirl effect
                if (dist > MOUSE_DIST && dist < MOUSE_ATTRACT_DIST) {
                    const attract = ((MOUSE_ATTRACT_DIST - dist) / MOUSE_ATTRACT_DIST) * 0.003;
                    n.vx -= (dx / dist) * attract;
                    n.vy -= (dy / dist) * attract;
                }

                // Speed clamp
                const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
                if (speed > 2.5) {
                    n.vx = (n.vx / speed) * 2.5;
                    n.vy = (n.vy / speed) * 2.5;
                }

                // Damping
                n.vx *= 0.995;
                n.vy *= 0.995;

                // Size pulse near mouse
                if (dist < MOUSE_DIST) {
                    const scale = 1 + ((MOUSE_DIST - dist) / MOUSE_DIST) * 3;
                    n.radius = n.baseRadius * scale;
                } else {
                    n.radius += (n.baseRadius - n.radius) * 0.05;
                }

                // Draw node with glow
                const brightness = dist < MOUSE_DIST ? 1 : dist < MOUSE_ATTRACT_DIST ? 0.5 : 0.25;
                const alpha = brightness * 0.8;

                // Outer glow for near-mouse particles
                if (dist < MOUSE_DIST) {
                    const glowAlpha = ((MOUSE_DIST - dist) / MOUSE_DIST) * 0.3;
                    ctx.fillStyle = `rgba(182, 255, 46, ${glowAlpha})`;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.radius * 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = `rgba(182, 255, 46, ${alpha})`;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
                ctx.fill();

                // Connections — stronger near mouse
                for (let j = i + 1; j < COUNT; j++) {
                    const n2 = nodes[j];
                    const cdx = n.x - n2.x;
                    const cdy = n.y - n2.y;
                    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                    if (cdist < CONNECTION_DIST) {
                        // Both near mouse = brighter connection
                        const midX = (n.x + n2.x) / 2;
                        const midY = (n.y + n2.y) / 2;
                        const midDist = Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2);
                        const mouseBoost = midDist < MOUSE_DIST ? 2.5 : 1;
                        const lineAlpha = (1 - cdist / CONNECTION_DIST) * 0.2 * mouseBoost;

                        ctx.strokeStyle = midDist < MOUSE_DIST
                            ? `rgba(182, 255, 46, ${lineAlpha})`
                            : `rgba(182, 255, 46, ${lineAlpha * 0.5})`;
                        ctx.lineWidth = midDist < MOUSE_DIST ? 1 : 0.5;
                        ctx.beginPath();
                        ctx.moveTo(n.x, n.y);
                        ctx.lineTo(n2.x, n2.y);
                        ctx.stroke();
                    }
                }

                // Lines from particles to mouse when very close
                if (dist < MOUSE_DIST * 0.6) {
                    const lineAlpha = ((MOUSE_DIST * 0.6 - dist) / (MOUSE_DIST * 0.6)) * 0.15;
                    ctx.strokeStyle = `rgba(74, 246, 38, ${lineAlpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            // ── Cursor crosshair ──
            ctx.strokeStyle = 'rgba(182, 255, 46, 0.12)';
            ctx.lineWidth = 0.5;
            // Horizontal
            ctx.beginPath();
            ctx.moveTo(mouse.x - 30, mouse.y);
            ctx.lineTo(mouse.x - 8, mouse.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(mouse.x + 8, mouse.y);
            ctx.lineTo(mouse.x + 30, mouse.y);
            ctx.stroke();
            // Vertical
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y - 30);
            ctx.lineTo(mouse.x, mouse.y - 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y + 8);
            ctx.lineTo(mouse.x, mouse.y + 30);
            ctx.stroke();
            // Center dot
            ctx.fillStyle = 'rgba(182, 255, 46, 0.25)';
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
            ctx.fill();

            animId = requestAnimationFrame(draw);
        };

        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{ opacity: 0.6 }}
        />
    );
}
