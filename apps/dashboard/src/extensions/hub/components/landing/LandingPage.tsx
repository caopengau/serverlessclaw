'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Zap,
  Brain,
  Shield,
  ArrowRight,
  MessageSquare,
  Gauge,
  Lock,
  BarChart3,
  Cpu,
  Globe,
  Database,
  Activity,
  Infinity,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';

import { translations } from './translations';

/**
 * Animated Electric Current Background - Enhanced for obvious horizontal flow
 */
const ElectricBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(0,255,157,0.08)_0%,_transparent_70%)]" />
    <svg
      className="w-full h-full opacity-30"
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="electric-line-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#00ff9d" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[...Array(15)].map((_, i) => (
        <g key={i} filter="url(#glow)">
          <path
            d={`M ${-200} ${80 * i + 50} L ${1200} ${80 * i + 50}`}
            stroke="url(#electric-line-1)"
            strokeWidth="2"
            fill="transparent"
            className="animate-[electric_6s_linear_infinite]"
            style={{
              animationDelay: `${i * -1.2}s`,
              opacity: 0.4 + Math.random() * 0.4,
              strokeWidth: 1 + Math.random() * 2,
            }}
          />
        </g>
      ))}
    </svg>
    <div className="absolute inset-0 bg-grid-white/[0.03] bg-[length:60px_60px]" />
  </div>
);

/**
 * Locale Switcher Component (Referencing clawmore.ai)
 */
const LocaleSwitcher = ({
  locale,
  setLocale,
}: {
  locale: 'en' | 'cn';
  setLocale: (l: 'en' | 'cn') => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const locales = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'cn', label: '中文', short: 'ZH' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLocaleData = locales.find((l) => l.code === locale) || locales[1]; // Default to ZH

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyber-green/30 transition-all font-mono group cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5 text-cyber-green group-hover:text-cyber-green transition-colors" />
        <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
          {currentLocaleData.short}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-white/50 transition-all duration-200 ${
            isOpen ? 'rotate-180 text-cyber-green' : 'group-hover:text-white/70'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 overflow-hidden rounded-sm border border-white/10 bg-black/95 backdrop-blur-2xl shadow-2xl z-50 animate-[fade-in_0.2s_ease-out]">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc.code}
                onClick={() => {
                  setLocale(loc.code as 'en' | 'cn');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-all ${
                  locale === loc.code
                    ? 'bg-cyber-green/10 text-cyber-green'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {loc.short}
                  </span>
                  <span className="text-sm">{loc.label}</span>
                </div>
                {locale === loc.code && <Check className="w-3.5 h-3.5 text-cyber-green" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for scroll reveal animations
 */
function useScrollReveal() {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const observers = useRef<IntersectionObserver[]>([]);

  const register = (id: string) => (el: HTMLElement | null) => {
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRevealed((prev) => new Set(prev).add(id));
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    observers.current.push(observer);
  };

  useEffect(() => {
    return () => observers.current.forEach((o) => o.disconnect());
  }, []);

  return { register, isRevealed: (id: string) => revealed.has(id) };
}

/**
 * Premium Sci-Fi Feature Card
 */
const SciFiCard = ({
  icon: Icon,
  title,
  description,
  delay,
  t,
  isRevealed,
}: {
  icon: any;
  title: string;
  description: string;
  delay: string;
  t: (key: string) => string;
  isRevealed: boolean;
}) => (
  <div
    className={`relative group p-[1px] rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-cyber-green/40 transition-all duration-700 hover:shadow-[0_0_20px_rgba(0,255,157,0.1)] ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
    style={{ transitionDelay: delay }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-cyber-green/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative p-6 bg-black/40 backdrop-blur-xl rounded-[11px] h-full flex flex-col">
      <div className="mb-4 relative">
        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-cyber-green group-hover:scale-110 transition-transform duration-500">
          <Icon size={24} />
        </div>
        <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-cyber-green/40 opacity-0 group-hover:opacity-100 transition-all duration-500" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:text-cyber-green transition-colors">
        {title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1">{description}</p>
      <div className="flex items-center gap-2 text-[10px] font-mono text-cyber-green/40 group-hover:text-cyber-green/80 transition-colors tracking-widest uppercase">
        <Activity size={10} /> {t('operational_core')}
      </div>
    </div>
  </div>
);

/**
 * Voltx Landing Page - Premium Sci-Fi / Energy Edition
 */
export function LandingPage({
  t: frameworkT,
  locale: frameworkLocale,
  setLocale: frameworkSetLocale,
}: {
  t?: (key: string) => string;
  locale?: 'en' | 'cn';
  setLocale?: (l: 'en' | 'cn') => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [localLocale, setLocalLocale] = useState<'en' | 'cn'>(frameworkLocale || 'cn');
  const { register, isRevealed } = useScrollReveal();

  // Update local locale if framework locale changes
  useEffect(() => {
    if (frameworkLocale) setLocalLocale(frameworkLocale);
  }, [frameworkLocale]);

  const setLocale = (l: 'en' | 'cn') => {
    setLocalLocale(l);
    if (frameworkSetLocale) frameworkSetLocale(l);
  };

  // Use translations based on locale
  const vt = (key: keyof typeof translations.en) => {
    return translations[localLocale][key] || translations.en[key] || key;
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-cyber-green selection:text-black font-mono">
      <style jsx global>{`
        @keyframes electric {
          0% {
            stroke-dasharray: 0 1000;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 500 500;
          }
          100% {
            stroke-dasharray: 0 1000;
            stroke-dashoffset: -1000;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .cyber-grid {
          background-image:
            linear-gradient(rgba(0, 255, 157, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 157, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }
        .reveal-transition {
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      <ElectricBackground />

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/5 py-4' : 'py-8'}`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 relative overflow-hidden bg-cyber-green rounded-[4px] flex items-center justify-center">
              <Zap size={20} className="text-black fill-black" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic group-hover:tracking-widest transition-all duration-500">
              Voltx
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
            <a href="#vision" className="hover:text-cyber-green transition-colors">
              {vt('nav_vision')}
            </a>
            <a href="#core" className="hover:text-cyber-green transition-colors">
              {vt('nav_core')}
            </a>
            <a href="#security" className="hover:text-cyber-green transition-colors">
              {vt('nav_security')}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <LocaleSwitcher locale={localLocale} setLocale={setLocale} />
            <Link
              href="/login"
              className="relative group overflow-hidden px-6 py-2 bg-white text-black font-black uppercase text-[11px] tracking-widest rounded-[4px] hover:bg-cyber-green transition-colors duration-500"
            >
              <span className="relative z-10 flex items-center gap-2">
                {vt('nav_access')} <ArrowUpRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-40 px-6 md:px-12 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div
            className={`relative z-10 space-y-8 reveal-transition ${isRevealed('hero-text') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
            ref={register('hero-text')}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-[9px] font-black uppercase tracking-[0.2em] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping" />
              {vt('hero_badge')}
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40">
              {vt('hero_title_1')} <br />
              <span className="text-cyber-green italic">{vt('hero_title_2')}</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-xl font-medium leading-relaxed">
              {vt('hero_description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/login"
                className="group relative px-8 py-4 bg-cyber-green text-black font-black uppercase text-[12px] tracking-[0.2em] rounded-[4px] overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {vt('init_mission')} <ArrowRight size={18} />
                </span>
              </Link>
              <button className="px-8 py-4 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white font-black uppercase text-[12px] tracking-[0.2em] rounded-[4px] transition-all">
                {vt('project_specs')}
              </button>
            </div>

            <div className="flex items-center gap-8 pt-8 border-t border-white/5">
              <div>
                <div className="text-2xl font-black text-white">99.99%</div>
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  {vt('uptime')}
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">~12ms</div>
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  {vt('latency')}
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">1.2M</div>
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  {vt('sync_rate')}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`relative hidden lg:block reveal-transition ${isRevealed('hero-visual') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            ref={register('hero-visual')}
          >
            <div className="absolute inset-0 bg-cyber-green/20 blur-[120px] rounded-full animate-pulse" />
            <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-3xl shadow-2xl">
              <div className="h-8 border-b border-white/5 bg-white/5 flex items-center px-4 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                <div className="w-2 h-2 rounded-full bg-green-500/50" />
                <div className="flex-1" />
                <div className="text-[8px] font-mono text-white/20 uppercase tracking-[0.2em]">
                  {vt('grid_status')}
                </div>
              </div>
              <div className="p-8 aspect-square flex items-center justify-center">
                <div className="relative w-64 h-64">
                  <div className="absolute inset-0 border-2 border-cyber-green/20 rounded-full animate-[spin_20s_linear_infinite]" />
                  <div className="absolute inset-4 border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                  <div className="absolute inset-12 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-3xl bg-cyber-green rotate-45 animate-pulse shadow-[0_0_50px_rgba(0,255,157,0.3)] flex items-center justify-center">
                      <Zap size={64} className="text-black -rotate-45" />
                    </div>
                  </div>
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyber-green/20 to-transparent"
                      style={{ transform: `translate(-50%, -50%) rotate(${i * 45}deg)` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section
        id="core"
        className="px-6 py-24 md:px-12 max-w-7xl mx-auto border-t border-white/5 bg-[radial-gradient(circle_at_50%_0%,_rgba(0,255,157,0.03)_0%,_transparent_50%)]"
      >
        <div
          className={`mb-16 space-y-4 reveal-transition ${isRevealed('features-header') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          ref={register('features-header')}
        >
          <div className="text-cyber-green text-[10px] font-black uppercase tracking-[0.3em]">
            {vt('core_engine_capabilities')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">{vt('powered_by')}</h2>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          ref={register('features-grid')}
        >
          <SciFiCard
            icon={Cpu}
            title={vt('feat_1_title')}
            description={vt('feat_1_desc')}
            delay="0.1s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Brain}
            title={vt('feat_2_title')}
            description={vt('feat_2_desc')}
            delay="0.2s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Shield}
            title={vt('feat_3_title')}
            description={vt('feat_3_desc')}
            delay="0.3s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Activity}
            title={vt('feat_4_title')}
            description={vt('feat_4_desc')}
            delay="0.4s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Infinity}
            title={vt('feat_5_title')}
            description={vt('feat_5_desc')}
            delay="0.5s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Database}
            title={vt('feat_6_title')}
            description={vt('feat_6_desc')}
            delay="0.6s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Globe}
            title={vt('feat_7_title')}
            description={vt('feat_7_desc')}
            delay="0.7s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
          <SciFiCard
            icon={Zap}
            title={vt('feat_8_title')}
            description={vt('feat_8_desc')}
            delay="0.8s"
            t={vt}
            isRevealed={isRevealed('features-grid')}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-6 py-24 md:px-12 max-w-7xl mx-auto overflow-hidden">
        <div className="absolute inset-0 bg-cyber-green/5 blur-[100px] rounded-full translate-y-1/2" />
        <div
          className={`relative border border-white/10 bg-white/[0.02] rounded-3xl p-12 md:p-24 text-center overflow-hidden reveal-transition ${isRevealed('cta') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          ref={register('cta')}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent" />
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">
            {vt('cta_title_1')} <br className="md:hidden" />{' '}
            <span className="italic text-cyber-green">{vt('cta_title_2')}</span>
          </h2>
          <p className="text-gray-400 mb-12 max-w-xl mx-auto text-lg font-medium">
            {vt('cta_desc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/login"
              className="px-10 py-5 bg-white text-black font-black uppercase text-[12px] tracking-[0.2em] rounded-[4px] hover:bg-cyber-green transition-all"
            >
              {vt('cta_sign_in')}
            </Link>
            <button className="px-10 py-5 border border-white/10 text-white font-black uppercase text-[12px] tracking-[0.2em] rounded-[4px] hover:bg-white/5 transition-all">
              {vt('cta_demo')}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 md:px-12 max-w-7xl mx-auto border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-50">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-cyber-green" />
          <span className="text-sm font-black uppercase tracking-widest">
            {vt('footer_system')}
          </span>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em]">
          {vt('footer_rights')}
        </div>
        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
          <a href="#" className="hover:text-cyber-green transition-colors">
            {vt('footer_tos')}
          </a>
          <a href="#" className="hover:text-cyber-green transition-colors">
            {vt('footer_privacy')}
          </a>
        </div>
      </footer>
    </div>
  );
}
