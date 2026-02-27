"use client"

import { useEffect, useRef, useState } from 'react';

export default function CountUp({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
    const [value, setValue] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const triggered = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !triggered.current) {
                    triggered.current = true;
                    const duration = 2000;
                    const start = performance.now();

                    const tick = (now: number) => {
                        const elapsed = now - start;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setValue(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(tick);
                    };

                    requestAnimationFrame(tick);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref} className="font-mono text-3xl lg:text-5xl text-[#B6FF2E] font-bold">
            {prefix}{value.toLocaleString()}{suffix}
        </span>
    );
}
