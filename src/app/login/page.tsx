"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogIn } from 'lucide-react';
import GridBackground from '@/components/GridBackground';
import { BorderBeam } from '@/components/BorderBeam';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      localStorage.setItem('logged_in_user', username);
      router.push('/');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#07080B] text-[#F4F6FF] selection:bg-[#B6FF2E] selection:text-[#07080B] overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute inset-0 pointer-events-none z-0"><GridBackground /></div>
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-20 mix-blend-overlay" />
      
      <div className="absolute top-8 left-8 z-50">
        <Link href="/" className="inline-flex items-center gap-2 text-[#A7ACBF] hover:text-[#B6FF2E] transition-colors">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>
      
      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block font-display font-bold text-3xl tracking-tight text-[#F4F6FF] mb-6">Darkmatter</Link>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-2">Welcome Back</h1>
          <p className="text-[#A7ACBF]">Enter your credentials to access the terminal.</p>
        </div>

        <form className="card-glass p-8 relative overflow-hidden group" onSubmit={handleLogin}>
          <BorderBeam size={200} duration={12} delay={9} colorFrom="#B6FF2E" colorTo="#07080B" />
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-[#A7ACBF] mb-2">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors" 
                placeholder="Enter your username" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm text-[#A7ACBF] mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#07080B] border border-white/10 rounded-lg px-4 py-3 text-[#F4F6FF] focus:border-[#B6FF2E]/50 focus:outline-none transition-colors" 
                placeholder="••••••••" 
                required 
              />
            </div>
          </div>
          
          <button type="submit" className="mt-8 w-full btn-accent flex items-center justify-center gap-2">
            <LogIn size={18} /> Login
          </button>
          
          <div className="mt-8 text-center border-t border-white/10 pt-6">
            <p className="text-sm text-[#A7ACBF]">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#B6FF2E] hover:underline transition-all">Sign up</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
