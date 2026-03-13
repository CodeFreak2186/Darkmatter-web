"use client"

import { useEffect, useRef, useLayoutEffect } from 'react';

// ─── GPU-style fluid simulation ──────────────────────────────
// Uses a velocity field + dye field approach:
// Moving the cursor injects velocity and dye into the field,
// which then advects, diffuses, and fades — creating a real
// fluid-drag effect like pulling paint through water.

export default function FluidSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // GSAP scroll pin
    useLayoutEffect(() => {
        if (!sectionRef.current || !window.gsap || !window.ScrollTrigger) return;
        const gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top top',
                    end: '+=130%',
                    pin: true,
                    scrub: 0.5,
                }
            });
            tl.fromTo('.fluid-title', { y: '80vh', opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out' }, 0);
            tl.fromTo('.fluid-subtitle', { y: '60vh', opacity: 0 }, { y: 0, opacity: 1 }, 0.08);
            tl.fromTo('.fluid-badge', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1 }, 0.12);
            tl.fromTo('.fluid-stats', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, 0.18);
            tl.fromTo('.fluid-content', { y: 0, opacity: 1 }, { y: '-40vh', opacity: 0, ease: 'power2.in' }, 0.7);
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Simulation resolution (lower = faster but blockier)
        const SIM_SCALE = 4;
        let W = Math.ceil(window.innerWidth / SIM_SCALE);
        let H = Math.ceil(window.innerHeight / SIM_SCALE);
        let cw = window.innerWidth;
        let ch = window.innerHeight;
        canvas.width = cw;
        canvas.height = ch;

        // Fields: velocity (vx, vy) and dye (r, g, b, a)
        let size = W * H;
        let vx = new Float32Array(size);
        let vy = new Float32Array(size);
        let vx0 = new Float32Array(size);
        let vy0 = new Float32Array(size);
        let dye = new Float32Array(size * 4); // RGBA
        let dye0 = new Float32Array(size * 4);

        const mouse = { x: 0, y: 0, px: 0, py: 0, down: false };
        let animId = 0;

        // ── Field helpers ──

        // Diffuse: spread values to neighbors
        const diffuse = (x: Float32Array, x0: Float32Array, diff: number, dt: number) => {
            const a = dt * diff * W * H;
            const c = 1 + 4 * a;
            for (let k = 0; k < 4; k++) {
                for (let j = 1; j < H - 1; j++) {
                    for (let i = 1; i < W - 1; i++) {
                        const idx = j * W + i;
                        x[idx] = (x0[idx] + a * (x[idx - 1] + x[idx + 1] + x[idx - W] + x[idx + W])) / c;
                    }
                }
            }
        };

        // Advect: move values along velocity field
        const advect = (d: Float32Array, d0: Float32Array, u: Float32Array, v: Float32Array, dt: number) => {
            for (let j = 1; j < H - 1; j++) {
                for (let i = 1; i < W - 1; i++) {
                    const idx = j * W + i;
                    let x = i - dt * W * u[idx];
                    let y = j - dt * H * v[idx];
                    x = Math.max(0.5, Math.min(W - 1.5, x));
                    y = Math.max(0.5, Math.min(H - 1.5, y));
                    const i0 = Math.floor(x), i1 = i0 + 1;
                    const j0 = Math.floor(y), j1 = j0 + 1;
                    const s1 = x - i0, s0 = 1 - s1;
                    const t1 = y - j0, t0 = 1 - t1;
                    d[idx] = s0 * (t0 * d0[j0 * W + i0] + t1 * d0[j1 * W + i0]) +
                        s1 * (t0 * d0[j0 * W + i1] + t1 * d0[j1 * W + i1]);
                }
            }
        };

        // Advect dye (RGBA)
        const advectDye = (d: Float32Array, d0: Float32Array, u: Float32Array, v: Float32Array, dt: number) => {
            for (let j = 1; j < H - 1; j++) {
                for (let i = 1; i < W - 1; i++) {
                    const idx = j * W + i;
                    let x = i - dt * W * u[idx];
                    let y = j - dt * H * v[idx];
                    x = Math.max(0.5, Math.min(W - 1.5, x));
                    y = Math.max(0.5, Math.min(H - 1.5, y));
                    const i0 = Math.floor(x), i1 = i0 + 1;
                    const j0 = Math.floor(y), j1 = j0 + 1;
                    const s1 = x - i0, s0 = 1 - s1;
                    const t1 = y - j0, t0 = 1 - t1;
                    for (let c = 0; c < 4; c++) {
                        d[idx * 4 + c] =
                            s0 * (t0 * d0[(j0 * W + i0) * 4 + c] + t1 * d0[(j1 * W + i0) * 4 + c]) +
                            s1 * (t0 * d0[(j0 * W + i1) * 4 + c] + t1 * d0[(j1 * W + i1) * 4 + c]);
                    }
                }
            }
        };

        // Project: make velocity divergence-free
        const project = (u: Float32Array, v: Float32Array, p: Float32Array, div: Float32Array) => {
            for (let j = 1; j < H - 1; j++) {
                for (let i = 1; i < W - 1; i++) {
                    const idx = j * W + i;
                    div[idx] = -0.5 * (u[idx + 1] - u[idx - 1] + v[idx + W] - v[idx - W]) / W;
                    p[idx] = 0;
                }
            }
            for (let k = 0; k < 4; k++) {
                for (let j = 1; j < H - 1; j++) {
                    for (let i = 1; i < W - 1; i++) {
                        const idx = j * W + i;
                        p[idx] = (div[idx] + p[idx - 1] + p[idx + 1] + p[idx - W] + p[idx + W]) / 4;
                    }
                }
            }
            for (let j = 1; j < H - 1; j++) {
                for (let i = 1; i < W - 1; i++) {
                    const idx = j * W + i;
                    u[idx] -= 0.5 * W * (p[idx + 1] - p[idx - 1]);
                    v[idx] -= 0.5 * H * (p[idx + W] - p[idx - W]);
                }
            }
        };

        const p = new Float32Array(size);
        const div = new Float32Array(size);

        // ── Inject force + dye at cursor ──
        const addForce = (px: number, py: number, fx: number, fy: number) => {
            const cx = px / SIM_SCALE;
            const cy = py / SIM_SCALE;
            const radius = 12;
            const r2 = radius * radius;
            for (let j = -radius; j <= radius; j++) {
                for (let i = -radius; i <= radius; i++) {
                    const d2 = i * i + j * j;
                    if (d2 > r2) continue;
                    const xi = Math.floor(cx + i);
                    const yj = Math.floor(cy + j);
                    if (xi < 0 || xi >= W || yj < 0 || yj >= H) continue;
                    const idx = yj * W + xi;
                    const falloff = 1 - d2 / r2;
                    vx[idx] += fx * falloff * 0.15;
                    vy[idx] += fy * falloff * 0.15;
                    // Inject green/cyan dye
                    const speed = Math.sqrt(fx * fx + fy * fy);
                    const intensity = Math.min(1, speed * 0.005) * falloff;
                    dye[idx * 4 + 0] = Math.min(1, dye[idx * 4 + 0] + intensity * 0.35); // R (slight)
                    dye[idx * 4 + 1] = Math.min(1, dye[idx * 4 + 1] + intensity * 1.0);  // G (dominant)
                    dye[idx * 4 + 2] = Math.min(1, dye[idx * 4 + 2] + intensity * 0.2);  // B (hint)
                    dye[idx * 4 + 3] = Math.min(1, dye[idx * 4 + 3] + intensity * 0.9);  // A
                }
            }
        };

        // ── Simulation step ──
        const dt = 0.016;
        const viscosity = 0.0001;
        const dyeDiffusion = 0.00005;
        const dyeFade = 0.995;

        const step = () => {
            // Velocity: diffuse → project → advect → project
            vx0.set(vx); vy0.set(vy);
            diffuse(vx, vx0, viscosity, dt);
            diffuse(vy, vy0, viscosity, dt);
            project(vx, vy, p, div);
            vx0.set(vx); vy0.set(vy);
            advect(vx, vx0, vx0, vy0, dt);
            advect(vy, vy0, vx0, vy0, dt);
            project(vx, vy, p, div);

            // Dye: diffuse → advect → fade
            dye0.set(dye);
            // Simple dye diffusion (single pass for speed)
            for (let j = 1; j < H - 1; j++) {
                for (let i = 1; i < W - 1; i++) {
                    const idx = j * W + i;
                    const a = dt * dyeDiffusion * W * H;
                    for (let c = 0; c < 4; c++) {
                        const offset = idx * 4 + c;
                        dye[offset] = (dye0[offset] + a * (
                            dye0[(idx - 1) * 4 + c] + dye0[(idx + 1) * 4 + c] +
                            dye0[(idx - W) * 4 + c] + dye0[(idx + W) * 4 + c]
                        )) / (1 + 4 * a);
                    }
                }
            }
            dye0.set(dye);
            advectDye(dye, dye0, vx, vy, dt);

            // Fade
            for (let i = 0; i < dye.length; i++) {
                dye[i] *= dyeFade;
            }
            // Velocity damping
            for (let i = 0; i < size; i++) {
                vx[i] *= 0.998;
                vy[i] *= 0.998;
            }
        };

        // ── Render ──
        const imgData = ctx.createImageData(W, H);
        const buf32 = new Uint8ClampedArray(imgData.data.buffer);

        // Offscreen for upscaling
        const offscreen = document.createElement('canvas');
        offscreen.width = W;
        offscreen.height = H;
        const offCtx = offscreen.getContext('2d')!;

        const render = () => {
            // Convert dye field to pixels
            for (let i = 0; i < size; i++) {
                const r = dye[i * 4 + 0];
                const g = dye[i * 4 + 1];
                const b = dye[i * 4 + 2];
                const a = dye[i * 4 + 3];

                // Color mapping: green-dominant with subtle color shifts
                const intensity = Math.max(r, g, b);
                const glow = Math.pow(intensity, 0.7);

                buf32[i * 4 + 0] = Math.min(255, Math.floor(r * 200 * glow + glow * 20));  // R
                buf32[i * 4 + 1] = Math.min(255, Math.floor(g * 255 * glow));               // G
                buf32[i * 4 + 2] = Math.min(255, Math.floor(b * 180 * glow + glow * 15));   // B
                buf32[i * 4 + 3] = Math.min(255, Math.floor(a * 255));                       // A
            }

            offCtx.putImageData(imgData, 0, 0);

            ctx.clearRect(0, 0, cw, ch);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(offscreen, 0, 0, cw, ch);

            // Cursor glow
            const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
            grd.addColorStop(0, 'rgba(182, 255, 46, 0.03)');
            grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, 200, 0, Math.PI * 2);
            ctx.fill();
        };

        // ── Animation loop ──
        const loop = () => {
            // Inject force from cursor movement
            const dx = mouse.x - mouse.px;
            const dy = mouse.y - mouse.py;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                addForce(mouse.x, mouse.y, dx, dy);
            }
            mouse.px = mouse.x;
            mouse.py = mouse.y;

            step();
            render();
            animId = requestAnimationFrame(loop);
        };

        // ── Ambient splashes to keep it alive even without cursor ──
        const ambientInterval = setInterval(() => {
            const ax = Math.random() * cw;
            const ay = Math.random() * ch;
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 60;
            addForce(ax, ay, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }, 2000);

        // Initial splash
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const ax = cw * (0.2 + Math.random() * 0.6);
                const ay = ch * (0.2 + Math.random() * 0.6);
                const angle = Math.random() * Math.PI * 2;
                addForce(ax, ay, Math.cos(angle) * 80, Math.sin(angle) * 80);
            }, i * 300);
        }

        // ── Events ──
        const onMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const t = e.touches[0];
            mouse.x = t.clientX - rect.left;
            mouse.y = t.clientY - rect.top;
        };

        const onResize = () => {
            cw = window.innerWidth;
            ch = window.innerHeight;
            canvas.width = cw;
            canvas.height = ch;
            W = Math.ceil(cw / SIM_SCALE);
            H = Math.ceil(ch / SIM_SCALE);
            size = W * H;
            vx = new Float32Array(size);
            vy = new Float32Array(size);
            vx0 = new Float32Array(size);
            vy0 = new Float32Array(size);
            dye = new Float32Array(size * 4);
            dye0 = new Float32Array(size * 4);
            offscreen.width = W;
            offscreen.height = H;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('resize', onResize);
        animId = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(animId);
            clearInterval(ambientInterval);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <section ref={sectionRef} className="relative w-screen h-screen overflow-hidden z-20">
            {/* Fluid canvas — pointer-events ON so cursor is tracked */}
            <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ cursor: 'none' }} />

            {/* Dark base */}
            <div className="absolute inset-0 bg-[#07080B] z-[-1]" />

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none z-10"
                style={{ background: 'radial-gradient(ellipse at center, transparent 30%, #07080B 100%)' }} />

            {/* Top/bottom fade for seamless transitions */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#07080B] to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07080B] to-transparent z-10 pointer-events-none" />

            {/* Content overlay */}
            <div className="fluid-content relative z-20 h-full flex flex-col items-center justify-center px-6 pointer-events-none">
                {/* Badge */}
                <div className="fluid-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B6FF2E]/10 bg-[#B6FF2E]/[0.03] backdrop-blur-sm mb-8">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B6FF2E] animate-pulse" />
                    <span className="text-[10px] font-mono text-[#B6FF2E] tracking-[0.3em]">NEURAL THREAT ENGINE</span>
                </div>

                {/* Title */}
                <h2 className="fluid-title font-display font-bold text-6xl sm:text-7xl lg:text-8xl xl:text-9xl text-[#F4F6FF] uppercase tracking-tight text-center leading-[0.9]">
                    Dark<span className="text-[#B6FF2E]">matter</span>
                </h2>

                {/* Subtitle */}
                <p className="fluid-subtitle mt-6 text-lg sm:text-xl text-[#A7ACBF]/80 max-w-lg text-center font-light leading-relaxed">
                    Move your cursor to interact — adaptive fluid intelligence flows through your infrastructure
                </p>

                {/* Stats row */}
                <div className="fluid-stats mt-14 flex items-center gap-8 sm:gap-14">
                    {[
                        { value: '99.7%', label: 'Detection Rate' },
                        { value: '<50ms', label: 'Response Time' },
                        { value: '24/7', label: 'Active Monitoring' },
                    ].map((stat, i) => (
                        <div key={i} className="text-center">
                            <div className="font-mono text-2xl sm:text-3xl font-bold text-[#B6FF2E]">{stat.value}</div>
                            <div className="text-[10px] text-[#666] font-mono tracking-wider mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="fluid-stats mt-12 pointer-events-auto">
                    <button className="btn-accent">Explore the platform</button>
                </div>
            </div>

            {/* Scan lines */}
            <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.012]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(182,255,46,0.5) 2px, rgba(182,255,46,0.5) 3px)',
                    backgroundSize: '100% 4px',
                }} />
        </section>
    );
}
