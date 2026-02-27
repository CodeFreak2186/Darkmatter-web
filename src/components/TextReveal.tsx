"use client"

import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface TextRevealProps {
    children: string;
    className?: string;
    scramble?: boolean;
    delay?: number;
}

const CHARS = '-./_[]{}!@#$%^&*()+=?<>~';

export default function TextReveal({ children, className, scramble = true, delay = 0 }: TextRevealProps) {
    const [displayText, setDisplayText] = useState(scramble ? '' : children);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!scramble) return;

        // Clear any existing interval
        if (intervalRef.current) clearInterval(intervalRef.current);

        const timeoutId = setTimeout(() => {
            let iteration = 0;

            intervalRef.current = setInterval(() => {
                setDisplayText(
                    children
                        .split('')
                        .map((_char, index) => {
                            if (index < iteration) {
                                return children[index];
                            }
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join('')
                );

                if (iteration >= children.length) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }

                iteration += 1 / 3; // Speed of reveal
            }, 30);
        }, delay * 1000);

        return () => {
            clearTimeout(timeoutId);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [children, scramble, delay]);

    return (
        <span className={cn('inline-block', className)}>
            {displayText}
        </span>
    );
}
