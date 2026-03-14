import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import GridBackground from '@/components/GridBackground';

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[#07080B] text-[#F4F6FF] selection:bg-[#B6FF2E] selection:text-[#07080B] overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute inset-0 pointer-events-none z-0"><GridBackground /></div>
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-20 mix-blend-overlay" />
      
      <div className="absolute top-8 left-8 z-50">
<<<<<<< HEAD
        <Link href="/" className="inline-flex items-center gap-2 text-[#A7ACBF] hover:text-[#B6FF2E] transition-colors">
=======
        <Link href="/" className="inline-flex items-center gap-2 text-[#A7ACBF] hover:text-[#B6FF2E] transition-all px-4 py-2 border border-white/10 rounded-lg bg-[#0A0D14]/50 backdrop-blur-md hover:border-[#B6FF2E]/30 hover:bg-[#B6FF2E]/5">
>>>>>>> main
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-[#B6FF2E]/10 mb-8 border border-[#B6FF2E]/20">
           <Shield size={48} className="text-[#B6FF2E]" />
        </div>
        <h1 className="font-display font-bold text-5xl sm:text-7xl tracking-tight mb-8">About <span className="text-[#B6FF2E] glow-text">Darkmatter</span></h1>
        <p className="text-xl sm:text-2xl text-[#A7ACBF] leading-relaxed max-w-3xl mx-auto font-light">
          An advanced AI-powered security platform that automatically scans, correlates, and analyzes threats across your infrastructure in real-time.
        </p>
      </div>
    </div>
  );
}
