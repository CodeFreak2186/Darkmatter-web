import Link from 'next/link';
import { ArrowLeft, Code, Activity, Terminal } from 'lucide-react';
import GridBackground from '@/components/GridBackground';

export default function GuidePage() {
  const features = [
    {
      title: 'Web IDE',
      icon: <Code size={32} className="text-[#B6FF2E]" />,
      description: 'paste your code, our tool will detect vulnerabilities that can form after deploying, or get code suggestions on how to improve security',
      color: 'from-[#B6FF2E]/20 to-transparent',
      borderColor: 'border-[#B6FF2E]/30',
      textColor: 'text-[#B6FF2E]'
    },
    {
      title: 'Dashboard',
      icon: <Activity size={32} className="text-[#ff9f43]" />,
      description: 'paste ur links and the tool will generate a report on the list of vulnerabilities found',
      color: 'from-[#ff9f43]/20 to-transparent',
      borderColor: 'border-[#ff9f43]/30',
      textColor: 'text-[#ff9f43]'
    },
    {
      title: 'Terminal',
      icon: <Terminal size={32} className="text-[#4af626]" />,
      description: 'use ur cybersecurity knowledge and our tool together to find vulneravbilities',
      color: 'from-[#4af626]/20 to-transparent',
      borderColor: 'border-[#4af626]/30',
      textColor: 'text-[#4af626]'
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#07080B] text-[#F4F6FF] selection:bg-[#B6FF2E] selection:text-[#07080B] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0"><GridBackground /></div>
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-20 mix-blend-overlay" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-[#A7ACBF] hover:text-[#B6FF2E] transition-colors mb-16">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="font-display font-bold text-5xl sm:text-6xl tracking-tight mb-6 mt-12">Platform <span className="text-[#B6FF2E] glow-text">Guide</span></h1>
          <p className="text-xl text-[#A7ACBF] leading-relaxed">
            Master the Darkmatter security suite. Understand our three core modules designed to find, analyze, and remediate vulnerabilities in real-time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title} 
              className={`card-glass bg-[#0A0D14]/80 backdrop-blur-md rounded-2xl relative overflow-hidden group hover:-translate-y-2 transition-all duration-300 border ${feature.borderColor}`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-b ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              <div className="relative z-10 p-8 flex flex-col h-full">
                <div className="mb-6 w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center border border-white/5">
                  {feature.icon}
                </div>
                <h2 className={`font-display font-semibold text-2xl mb-4 ${feature.textColor} uppercase tracking-wide`}>
                  {feature.title}
                </h2>
                <p className="text-[#A7ACBF] leading-relaxed flex-grow text-lg">
                  {feature.description}
                </p>
                <div className="mt-10">
                   <Link href={`/${feature.title.toLowerCase().replace('web ', '')}`} className={`inline-flex items-center gap-2 text-sm font-semibold ${feature.textColor} hover:opacity-80 transition-opacity py-2`}>
                     Launch Module <ArrowLeft size={16} className="rotate-180" />
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
