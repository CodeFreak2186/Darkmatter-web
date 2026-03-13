"use client"

import { useEffect, useRef } from 'react';

export default function CursorFire() {
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

        const onResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);

        interface Particle {
            x: number; y: number;
            vx: number; vy: number;
            life: number; maxLife: number;
            size: number;
            hue: number;
        }

        const particles: Particle[] = [];

        const spawn = (count: number) => {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 3 + 1;
                particles.push({
                    x: mouse.x + (Math.random() - 0.5) * 8,
                    y: mouse.y + (Math.random() - 0.5) * 8,
                    vx: Math.cos(angle) * speed * 0.5,
                    vy: Math.sin(angle) * speed * -1.2 - 1, // upward drift
                    life: 0,
                    maxLife: Math.random() * 25 + 15,
                    size: Math.random() * 5 + 2,
                    hue: 75 + Math.random() * 30, // 75-105 = green/yellow range
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, w, h);

            spawn(4);

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.life++;
                p.x += p.vx;
                p.y += p.vy;
                p.vy -= 0.02; // slight upward acceleration
                p.size *= 0.96;

                const progress = p.life / p.maxLife;
                const alpha = 1 - progress;

                if (progress < 0.3) {
                    // Core: bright white-green
                    ctx.fillStyle = `hsla(${p.hue}, 100%, ${90 - progress * 100}%, ${alpha})`;
                } else if (progress < 0.6) {
                    // Mid: neon green
                    ctx.fillStyle = `hsla(${p.hue}, 100%, 55%, ${alpha * 0.8})`;
                } else {
                    // Tail: dark green/transparent
                    ctx.fillStyle = `hsla(${p.hue}, 80%, 30%, ${alpha * 0.5})`;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(p.size, 0), 0, Math.PI * 2);
                ctx.fill();

                // Glow layer
                if (progress < 0.4) {
                    ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${alpha * 0.15})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                if (p.life >= p.maxLife || p.size < 0.2) {
                    particles.splice(i, 1);
                }
            }

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
            className="pointer-events-none fixed inset-0 z-[9999]"
            style={{ mixBlendMode: 'screen' }}
        />
    );
}
