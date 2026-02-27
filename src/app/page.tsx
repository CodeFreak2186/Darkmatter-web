"use client";

import { useRef, useLayoutEffect } from 'react';
import { Shield, Zap, Eye, Cpu, Lock, Code, FileText, Globe, Menu, Send, Mail, Twitter, Github, Linkedin, Activity, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';
import Link from 'next/link';
import SmoothScroll from '@/components/SmoothScroll';
import GridBackground from '@/components/GridBackground';
import TextReveal from '@/components/TextReveal';
import { BorderBeam } from '@/components/BorderBeam';
import ParticleField from '@/components/ParticleField';
import ThreatRadar from '@/components/ThreatRadar';
import GlobeWireframe from '@/components/GlobeWireframe';
import CountUp from '@/components/CountUp';
import { ArsenalSection, ProtocolSection } from '@/components/ArsenalSection';
import FluidSection from '@/components/FluidSection';

declare global { interface Window { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger; } }

function useGsapPin(sectionRef: React.RefObject<HTMLElement | null>, bgRef: React.RefObject<HTMLDivElement | null>, entranceAnimations: (tl: any, gsap: any, bg: HTMLDivElement) => void, exitAnimations: (tl: any, gsap: any, bg: HTMLDivElement) => void) {
  useLayoutEffect(() => {
    if (!sectionRef.current || !bgRef.current || !window.gsap || !window.ScrollTrigger) return;
    const gsap = window.gsap; gsap.registerPlugin(window.ScrollTrigger);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '+=130%', pin: true, scrub: 0.5 } });
      entranceAnimations(tl, gsap, bgRef.current!);
      exitAnimations(tl, gsap, bgRef.current!);
    }, sectionRef);
    return () => ctx.revert();
  }, []);
}

function Navigation() {
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const h = () => { if (navRef.current) { if (window.scrollY > 100) { navRef.current.classList.add('bg-[#07080B]/90', 'backdrop-blur-md'); navRef.current.classList.remove('bg-transparent'); } else { navRef.current.classList.remove('bg-[#07080B]/90', 'backdrop-blur-md'); navRef.current.classList.add('bg-transparent'); } } };
    window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h);
  }, []);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <nav ref={navRef} className="fixed top-0 left-0 right-0 z-[100] transition-all duration-500 bg-transparent">
      <div className="flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="font-display font-bold text-xl tracking-tight text-[#F4F6FF]">Darkmatter</div>
        <div className="hidden lg:flex items-center gap-10">
          <button onClick={() => go('capabilities')} className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors">Product</button>
          <button onClick={() => go('stats')} className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors">Stats</button>
          <button onClick={() => go('threat-map')} className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors">Threat Map</button>
          <Link href="/dashboard" className="text-sm text-[#ff9f43] hover:text-white transition-colors flex items-center gap-1.5 font-medium"><Activity size={15} /> Dashboard</Link>
          <Link href="/terminal" className="text-sm text-[#4af626] hover:text-white transition-colors flex items-center gap-1.5 font-medium"><Terminal size={15} /> Terminal</Link>
          <Link href="/ide" className="text-sm text-[#B6FF2E] hover:text-white transition-colors flex items-center gap-1.5 font-medium"><Code size={15} /> Web IDE</Link>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/dashboard" className="px-4 py-2.5 border border-[#ff9f43]/80 text-[#ff9f43] text-sm font-semibold hover:bg-[#ff9f43]/10 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-1.5"><Activity size={15} /> Dashboard</Link>
          <Link href="/terminal" className="px-4 py-2.5 border border-[#4af626]/80 text-[#4af626] text-sm font-semibold hover:bg-[#4af626]/10 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-1.5"><Terminal size={15} /> Terminal</Link>
          <Link href="/ide" className="px-4 py-2.5 bg-[#B6FF2E] text-[#07080B] text-sm font-semibold hover:bg-[#a8ee20] transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-1.5"><Code size={15} /> Web IDE</Link>
        </div>
        <button className="lg:hidden text-[#F4F6FF]"><Menu size={24} /></button>
      </div>
    </nav>
  );
}

function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!sectionRef.current || !bgRef.current || !window.gsap || !window.ScrollTrigger) return;
    const gsap = window.gsap; gsap.registerPlugin(window.ScrollTrigger);
    const ctx = gsap.context(() => {
      const loadTl = gsap.timeline();
      loadTl.fromTo(bgRef.current, { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' });
      loadTl.fromTo('.hero-label', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.8');
      loadTl.fromTo('.hero-title span', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, '-=0.4');
      loadTl.fromTo('.hero-subtitle', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4');
      loadTl.fromTo('.hero-cta', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');
      const scrollTl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '+=130%', pin: true, scrub: 0.5 } });
      scrollTl.fromTo('.hero-content', { y: 0, opacity: 1 }, { y: '-30vh', opacity: 0, ease: 'power2.in' }, 0.7);
      scrollTl.fromTo(bgRef.current, { scale: 1, y: 0 }, { scale: 1.15, y: '-10vh', ease: 'none' }, 0.7);
    }, sectionRef);
    return () => ctx.revert();
  }, []);
  return (
    <section ref={sectionRef} className="relative w-screen h-screen overflow-hidden z-10">
      <div ref={bgRef} className="absolute inset-0"><GridBackground /><ParticleField /><div className="absolute inset-0 bg-gradient-to-b from-[#07080B]/40 via-[#07080B]/30 to-[#07080B]/70 pointer-events-none" /></div>
      <div className="hero-content relative z-10 h-full flex flex-col items-center justify-center px-6">
        <div className="hero-label font-mono text-xs text-[#B6FF2E] mb-6 tracking-[0.3em]"><TextReveal delay={0.5}>DARKMATTER v2.4</TextReveal></div>
        <h1 className="hero-title font-display font-bold text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#F4F6FF] uppercase tracking-tight leading-none mb-8 text-center">
          <span className="block"><TextReveal delay={0.2} scramble>AI Security</TextReveal></span>
          <span className="block"><TextReveal delay={0.4} scramble>Engine</TextReveal></span>
        </h1>
        <p className="hero-subtitle text-lg sm:text-xl text-[#A7ACBF] max-w-2xl text-center mb-12 leading-relaxed">Coordinated agents scan, correlate, and summarize findings—so your team moves faster.</p>
        <button className="hero-cta btn-accent text-base sm:text-lg">Request a demo</button>
      </div>
      <div className="absolute bottom-[10vh] left-[10vw] right-[10vw] h-px bg-gradient-to-r from-transparent via-[#B6FF2E]/30 to-transparent" />
    </section>
  );
}

function DashboardSection() {
  const s = useRef<HTMLElement>(null), b = useRef<HTMLDivElement>(null);
  useGsapPin(s, b, (tl) => { tl.fromTo(b.current, { scale: 1.1, opacity: 0.5 }, { scale: 1, opacity: 1 }, 0); tl.fromTo('.dash-headline', { x: '-50vw', opacity: 0 }, { x: 0, opacity: 1 }, 0); tl.fromTo('.dash-card', { x: '50vw', opacity: 0, scale: 0.95 }, { x: 0, opacity: 1, scale: 1 }, 0); },
    (tl) => { tl.fromTo('.dash-headline', { x: 0, opacity: 1 }, { x: '-30vw', opacity: 0 }, 0.7); tl.fromTo('.dash-card', { x: 0, opacity: 1 }, { x: '30vw', opacity: 0 }, 0.7); tl.fromTo(b.current, { scale: 1, y: 0 }, { scale: 1.08, y: '-5vh' }, 0.7); });
  const feats = [{ icon: <Zap size={18} />, text: 'Real-time correlation' }, { icon: <Shield size={18} />, text: 'Risk scoring' }, { icon: <FileText size={18} />, text: 'Export-ready reports' }];
  return (
    <section ref={s} className="relative w-screen h-screen overflow-hidden z-40">
      <div ref={b} className="absolute inset-0"><img src="/images/neon_portrait_dashboard.jpg" alt="Dashboard" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#07080B]/90 via-[#07080B]/60 to-[#07080B]/80" /></div>
      <div className="relative z-10 h-full flex items-center px-6 lg:px-16">
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="dash-headline lg:w-1/2">
            <h2 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-[#F4F6FF] uppercase tracking-tight leading-none">SEE WHAT<br /><span className="text-[#B6FF2E] glow-text">OTHERS MISS</span></h2>
            <p className="mt-8 text-lg text-[#A7ACBF] max-w-md leading-relaxed">Correlate findings across agents. Surface real risk. Skip the noise.</p>
            <div className="mt-10"><button className="btn-accent">View live demo</button></div>
          </div>
          <div className="dash-card lg:w-2/5 w-full">
            <div className="card-glass p-6 lg:p-8 relative overflow-hidden group">
              <BorderBeam size={250} duration={12} delay={9} />
              <div className="w-2/5 h-1 bg-[#B6FF2E] mb-6" /><h3 className="font-display font-semibold text-xl text-[#F4F6FF] mb-6">Analysis Dashboard</h3>
              <div className="space-y-4">{feats.map((f, i) => (<div key={i} className="flex items-center gap-4 text-[#A7ACBF]"><span className="text-[#B6FF2E]">{f.icon}</span><span>{f.text}</span></div>))}</div>
              <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                <div><div className="font-mono text-2xl text-[#B6FF2E]">2.4k</div><div className="text-xs text-[#A7ACBF]">Scans</div></div>
                <div><div className="font-mono text-2xl text-[#B6FF2E]">847</div><div className="text-xs text-[#A7ACBF]">Findings</div></div>
                <div><div className="font-mono text-2xl text-[#B6FF2E]">99.9%</div><div className="text-xs text-[#A7ACBF]">Uptime</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTAChapterSection() {
  const s = useRef<HTMLElement>(null), b = useRef<HTMLDivElement>(null);
  useGsapPin(s, b, (tl) => { tl.fromTo(b.current, { y: '10vh', scale: 1.08, opacity: 0.6 }, { y: 0, scale: 1, opacity: 1 }, 0); tl.fromTo('.cta-title', { y: '50vh', opacity: 0 }, { y: 0, opacity: 1 }, 0); tl.fromTo('.cta-btn', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, 0.15); },
    (tl) => { tl.fromTo('.cta-title', { y: 0, opacity: 1 }, { y: '-40vh', opacity: 0 }, 0.7); tl.fromTo('.cta-btn', { y: 0, opacity: 1 }, { y: '-20vh', opacity: 0 }, 0.7); tl.fromTo(b.current, { y: 0, scale: 1 }, { y: '-8vh', scale: 1.06 }, 0.7); });
  return (
    <section ref={s} className="relative w-screen h-screen overflow-hidden z-50">
      <div ref={b} className="absolute inset-0"><img src="/images/laptop_dark_scene.jpg" alt="CTA" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-b from-[#07080B]/60 via-[#07080B]/40 to-[#07080B]/80" /></div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <h2 className="cta-title font-display font-bold text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#F4F6FF] uppercase tracking-tight text-center leading-tight">READY WHEN<br />YOU ARE</h2>
        <div className="cta-btn mt-12"><button className="btn-accent animate-pulse-glow">Request a demo</button></div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!sectionRef.current || !window.gsap) return;
    const gsap = window.gsap;
    const ctx = gsap.context(() => {
      gsap.fromTo('.cap-heading', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1, scrollTrigger: { trigger: '.cap-heading', start: 'top 80%', end: 'top 50%', scrub: 0.5 } });
      gsap.utils.toArray('.cap-card').forEach((card: unknown) => { gsap.fromTo(card as Element, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, scrollTrigger: { trigger: card as Element, start: 'top 85%', end: 'top 55%', scrub: 0.5 } }); });
    }, sectionRef);
    return () => ctx.revert();
  }, []);
  const caps = [{ title: 'Coordinated Agents', desc: 'Discovery • Fuzzing • Auth • Config • Code', icon: <Cpu size={28} /> }, { title: 'Live Dashboard', desc: 'Prioritized findings with context you can act on.', icon: <Eye size={28} /> }, { title: 'Export & Integrate', desc: 'PDF, SARIF, and webhook support.', icon: <Code size={28} /> }];
  const logos = ['TechCrunch', 'Wired', 'Forbes', 'The Verge', 'Bloomberg', 'Reuters', 'CNBC', 'The Guardian'];
  return (
    <section id="capabilities" ref={sectionRef} className="relative bg-[#0E111A] py-24 lg:py-32 z-60">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="cap-heading lg:w-2/5"><h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-[#F4F6FF] leading-tight">Built for<br />security teams</h2><p className="mt-6 text-lg text-[#A7ACBF] leading-relaxed">Darkmatter runs continuous discovery, fuzzing, auth testing, and code correlation—then turns noise into narrative.</p></div>
          <div className="lg:w-3/5 space-y-6">{caps.map((c) => (<div key={c.title} className="cap-card card-glass p-6 lg:p-8 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group"><BorderBeam size={200} duration={12} delay={9} colorFrom="#B6FF2E" colorTo="#07080B" /><div className="flex items-start gap-5"><div className="text-[#B6FF2E] mt-1">{c.icon}</div><div><h3 className="font-display font-semibold text-xl text-[#F4F6FF] mb-2">{c.title}</h3><p className="text-[#A7ACBF]">{c.desc}</p></div></div></div>))}</div>
        </div>
        <div className="mt-20 pt-12 border-t border-white/5"><p className="text-center text-sm text-[#A7ACBF] mb-8 font-mono tracking-wider">FEATURED IN</p><div className="relative overflow-hidden"><div className="flex animate-marquee">{[...logos, ...logos].map((l, i) => (<div key={i} className="flex-shrink-0 px-12 text-2xl font-display font-semibold text-[#A7ACBF]/40">{l}</div>))}</div></div></div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section id="stats" className="relative py-28 bg-[#07080B] overflow-hidden z-60">
      <div className="absolute inset-0 opacity-30"><ParticleField /></div>
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center text-[#F4F6FF] mb-4">By The Numbers</h2>
        <p className="text-center text-[#A7ACBF] mb-16">Real-time operational metrics from our global infrastructure.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[{ n: 99, s: '.9%', l: 'Uptime SLA' }, { n: 2400000, s: '+', l: 'Threats Blocked' }, { n: 12, s: 'ms', l: 'Avg Latency' }, { n: 186, s: '', l: 'Countries Protected' }].map((d, i) => (
            <div key={i} className="text-center p-8 card-glass"><CountUp target={d.n} suffix={d.s} /><div className="text-sm text-[#A7ACBF] mt-3 font-mono tracking-wider">{d.l}</div></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ThreatMapSection() {
  return (
    <section id="threat-map" className="relative py-28 bg-[#0E111A] overflow-hidden z-60">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-center text-[#F4F6FF] mb-4">Global Threat Intelligence</h2>
        <p className="text-center text-[#A7ACBF] mb-16">Live monitoring across 186 countries. Every dot is a neutralized threat.</p>
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 flex justify-center"><GlobeWireframe /></div>
          <div className="lg:w-1/2">
            <div className="card-glass p-8 relative overflow-hidden"><BorderBeam size={200} duration={15} colorFrom="#B6FF2E" colorTo="#ff4040" />
              <h3 className="font-display text-xl text-[#F4F6FF] font-semibold mb-6 flex items-center gap-3"><Activity className="text-[#B6FF2E]" size={20} /> Live Radar</h3>
              <ThreatRadar />
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div><div className="flex items-center justify-center gap-1 text-green-400 text-sm"><CheckCircle size={14} /> Clear</div><div className="font-mono text-lg text-[#F4F6FF]">142</div></div>
                <div><div className="flex items-center justify-center gap-1 text-yellow-400 text-sm"><AlertTriangle size={14} /> Warning</div><div className="font-mono text-lg text-[#F4F6FF]">31</div></div>
                <div><div className="flex items-center justify-center gap-1 text-red-400 text-sm"><AlertTriangle size={14} /> Critical</div><div className="font-mono text-lg text-[#F4F6FF]">7</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const s = useRef<HTMLElement>(null), b = useRef<HTMLDivElement>(null);
  useGsapPin(s, b, (tl) => { tl.fromTo(b.current, { scale: 1.15, opacity: 0.5 }, { scale: 1, opacity: 1 }, 0); tl.fromTo('.trust-title', { y: '50vh', opacity: 0 }, { y: 0, opacity: 1 }, 0); tl.fromTo('.trust-cta', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, 0.15); },
    (tl) => { tl.fromTo('.trust-title', { y: 0, opacity: 1 }, { y: '-40vh', opacity: 0 }, 0.7); tl.fromTo('.trust-cta', { y: 0, opacity: 1 }, { y: '-20vh', opacity: 0 }, 0.7); tl.fromTo(b.current, { scale: 1, y: 0 }, { scale: 1.08, y: '-5vh' }, 0.7); });
  return (
    <section id="trust" ref={s} className="relative w-screen h-screen overflow-hidden z-70">
      <div ref={b} className="absolute inset-0"><img src="/images/server_room.jpg" alt="Server Room" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#07080B]/80 via-[#07080B]/50 to-[#07080B]/70" /></div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <h2 className="trust-title font-display font-bold text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#F4F6FF] uppercase tracking-tight text-center leading-tight">SECURITY NEVER<br />SLEEPS</h2>
        <div className="trust-cta mt-12"><button className="btn-accent">Meet the team</button></div>
      </div>
    </section>
  );
}

function VisionSection() {
  const s = useRef<HTMLElement>(null), b = useRef<HTMLDivElement>(null);
  useGsapPin(s, b, (tl) => { tl.fromTo(b.current, { x: '-8vw', scale: 1.1, opacity: 0.6 }, { x: 0, scale: 1, opacity: 1 }, 0); tl.fromTo('.vision-title', { y: '50vh', opacity: 0 }, { y: 0, opacity: 1 }, 0); tl.fromTo('.vision-cta', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, 0.15); },
    (tl) => { tl.fromTo('.vision-title', { y: 0, opacity: 1 }, { y: '-40vh', opacity: 0 }, 0.7); tl.fromTo('.vision-cta', { y: 0, opacity: 1 }, { y: '-20vh', opacity: 0 }, 0.7); tl.fromTo(b.current, { x: 0, scale: 1 }, { x: '8vw', scale: 1.06 }, 0.7); });
  return (
    <section id="vision" ref={s} className="relative w-screen h-screen overflow-hidden z-80">
      <div ref={b} className="absolute inset-0"><img src="/images/neon_mask_portrait.jpg" alt="Vision" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#07080B]/70 via-[#07080B]/40 to-[#07080B]/70" /></div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <h2 className="vision-title font-display font-bold text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#F4F6FF] uppercase tracking-tight text-center leading-tight">THE FUTURE OF<br /><span className="text-[#B6FF2E] glow-text">DEFENSE</span></h2>
        <div className="vision-cta mt-12"><button className="btn-accent animate-pulse-glow">Get early access</button></div>
      </div>
    </section>
  );
}

function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!sectionRef.current || !window.gsap) return;
    const gsap = window.gsap;
    const ctx = gsap.context(() => {
      gsap.fromTo('.contact-left', { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, scrollTrigger: { trigger: '.contact-left', start: 'top 80%', end: 'top 50%', scrub: 0.5 } });
      gsap.fromTo('.contact-form', { y: 60, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 1, scrollTrigger: { trigger: '.contact-form', start: 'top 85%', end: 'top 55%', scrub: 0.5 } });
    }, sectionRef);
    return () => ctx.revert();
  }, []);
  return (
    <section id="contact" ref={sectionRef} className="relative bg-[#07080B] py-24 lg:py-32 z-90">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="contact-left lg:w-2/5">
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-[#F4F6FF] leading-tight">Let&apos;s build the next layer of defense.</h2>
            <p className="mt-6 text-lg text-[#A7ACBF] leading-relaxed">Tell us what you&apos;re scanning, and we&apos;ll show how Darkmatter fits.</p>
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-4 text-[#A7ACBF]"><Mail size={20} className="text-[#B6FF2E]" /><span>hello@darkmatter.ai</span></div>
              <div className="flex items-center gap-4 text-[#A7ACBF]"><Globe size={20} className="text-[#B6FF2E]" /><span>darkmatter.ai</span></div>
              <div className="flex items-center gap-4 text-[#A7ACBF]"><Lock size={20} className="text-[#B6FF2E]" /><span>SOC 2 Type II Certified</span></div>
            </div>
            <div className="mt-10 flex gap-4">
              {[Twitter, Github, Linkedin].map((Icon, i) => (<a key={i} href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-[#A7ACBF] hover:text-[#B6FF2E] hover:border-[#B6FF2E]/50 transition-all"><Icon size={18} /></a>))}
            </div>
          </div>
          <div className="contact-form lg:w-3/5">
            <form className="card-glass p-8 lg:p-10" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }}>
              <div className="grid sm:grid-cols-2 gap-6">
                <div><label className="block text-sm text-[#A7ACBF] mb-2">Name</label><input type="text" className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors" placeholder="John Doe" required /></div>
                <div><label className="block text-sm text-[#A7ACBF] mb-2">Email</label><input type="email" className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors" placeholder="john@company.com" required /></div>
              </div>
              <div className="mt-6"><label className="block text-sm text-[#A7ACBF] mb-2">Company</label><input type="text" className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors" placeholder="Acme Inc." /></div>
              <div className="mt-6"><label className="block text-sm text-[#A7ACBF] mb-2">Message</label><textarea rows={4} className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors resize-none" placeholder="Tell us about your security needs..." required /></div>
              <button type="submit" className="mt-8 w-full btn-accent flex items-center justify-center gap-2"><Send size={18} /> Send message</button>
            </form>
          </div>
        </div>
        <footer className="mt-24 pt-8 border-t border-white/5"><div className="flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex gap-6 text-sm text-[#A7ACBF]"><a href="#" className="hover:text-[#F4F6FF] transition-colors">Privacy</a><a href="#" className="hover:text-[#F4F6FF] transition-colors">Terms</a><a href="#" className="hover:text-[#F4F6FF] transition-colors">Security</a></div><div className="text-sm text-[#A7ACBF]">© 2026 Darkmatter Labs</div></div></footer>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <SmoothScroll>
      <div className="relative bg-[#07080B] min-h-screen text-[#F4F6FF] selection:bg-[#B6FF2E] selection:text-[#07080B] font-sans">
        <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-20 mix-blend-overlay" />
        <Navigation />
        <main className="relative">
          <HeroSection />
          <FluidSection />
          <DashboardSection />
          <CTAChapterSection />
          <CapabilitiesSection />
          <ArsenalSection onOpenTerminal="/terminal" onOpenIDE="/ide" />
          <ProtocolSection />
          <StatsSection />
          <ThreatMapSection />
          <TrustSection />
          <VisionSection />
          <ContactSection />
        </main>
      </div>
    </SmoothScroll>
  );
}
