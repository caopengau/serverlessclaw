'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Zap,
  Brain,
  Shield,
  Cpu,
  Globe,
  Database,
  Activity,
  Infinity as LucideInfinity,
  ArrowUpRight,
} from 'lucide-react';

const translations = {
  en: {
    nav_vision: 'Vision',
    nav_core: 'Core',
    nav_security: 'Security',
    nav_access: 'Access System',
    hero_badge: 'System Online',
    hero_title_1: 'AI Driven',
    hero_title_2: 'Next-Gen Smart Grid',
    hero_description:
      "The world's first AI-native autonomous energy trading platform. Orchestrating the global energy transition with precision and speed.",
    init_mission: 'Initialize Mission',
    uptime: 'Reliability',
    latency: 'Latency',
    core_engine_capabilities: 'Core Capabilities',
    powered_by: 'Powered by Voltx Engine',
    cta_title_1: 'Ready to',
    cta_title_2: 'Synchronize?',
    cta_sign_in: 'Sign In Now',
    footer_system: 'Voltx Operating System',
    operational_core: 'Operational Core',
    feat_1_title: 'Quantum Load Balancing',
    feat_1_desc:
      'Real-time distribution of energy loads across distributed networks with microsecond precision.',
    feat_2_title: 'Autonomous Trading',
    feat_2_desc:
      'Self-optimizing agents that execute trades on energy markets based on real-time grid conditions.',
    feat_3_title: 'Encrypted Security',
    feat_3_desc:
      'Military-grade encryption for all grid communications and financial transactions.',
    feat_4_title: 'Real-time Telemetry',
    feat_4_desc:
      'Instant visual feedback of every watt moving through the decentralized energy network.',
    feat_5_title: 'Infinite Scaling',
    feat_5_desc:
      'Architecture designed to support millions of concurrent energy nodes without performance loss.',
    feat_6_title: 'Neural Optimization',
    feat_6_desc:
      'Deep learning models that predict demand spikes before they happen with 99.9% accuracy.',
    feat_7_title: 'Global Energy Mesh',
    feat_7_desc:
      'Connect your local grid to the global Voltx mesh network for maximum arbitrage and efficiency.',
    feat_8_title: 'Instant Sync',
    feat_8_desc: 'Sub-10ms synchronization across geographically distributed power systems.',
    footer_desc:
      'The mission-critical operating system for the next generation of energy grids. Secure, autonomous, and unstoppable.',
    footer_platform: 'Platform',
    footer_neural_core: 'Neural Core',
    footer_quantum_grid: 'Quantum Grid',
    footer_security_shield: 'Security Shield',
    footer_network: 'Network',
    footer_docs: 'Documentation',
    footer_api: 'API Access',
    footer_gov: 'Governance',
    footer_rights: '© 2026 VOLTX. ALL RIGHTS RESERVED.',
    footer_tos: 'TOS',
    footer_privacy: 'Privacy',
  },
  cn: {
    nav_vision: '核心愿景',
    nav_core: '核心技术',
    nav_security: '安全合规',
    nav_access: '进入系统',
    hero_badge: '系统运行中',
    hero_title_1: 'AI 驱动',
    hero_title_2: '新一代智慧电网',
    hero_description: '全球首个 AI 原生自主能源交易平台，以极致效率协调全球能源转型。',
    init_mission: '启动任务',
    uptime: '可靠性',
    latency: '执行延迟',
    sync_rate: '同步率',
    core_engine_capabilities: '核心能力',
    powered_by: '由 Voltx 引擎驱动',
    cta_title_1: '准备好',
    cta_title_2: '接入网络了吗？',
    cta_sign_in: '即刻登录',
    footer_system: 'Voltx 操作系统',
    operational_core: '运行核心',
    feat_1_title: '量子负载均衡',
    feat_1_desc: '在分布式网络中实时分配能源负载，精确度达到微秒级。',
    feat_2_title: '自主化交易',
    feat_2_desc: '基于实时电网工况，由自优化智能体在能源市场执行交易。',
    feat_3_title: '军工级加密',
    feat_3_desc: '为所有电网通信和金融交易提供最高等级的安全保障。',
    feat_4_title: '实时全景遥测',
    feat_4_desc: '即时反馈去中心化能源网络中每一瓦特的流动细节。',
    feat_5_title: '无限扩展架构',
    feat_5_desc: '支持数百万并发能源节点，且不损失任何系统性能。',
    feat_6_title: '神经网络优化',
    feat_6_desc: '深度学习模型以 99.9% 的准确率预判电力需求高峰。',
    feat_7_title: '全球能源互联',
    feat_7_desc: '将本地电网接入全球 Voltx 网格，实现最大化的套利空间。',
    feat_8_title: '亚毫秒级同步',
    feat_8_desc: '实现跨地域分布式电厂之间的超低延迟协同同步。',
    footer_desc: '为下一代能源网格打造的关键任务操作系统。安全、自主、势不可挡。',
    footer_platform: '平台',
    footer_neural_core: '神经核心',
    footer_quantum_grid: '量子网格',
    footer_security_shield: '安全护盾',
    footer_network: '网络',
    footer_docs: '文档',
    footer_api: 'API 接入',
    footer_gov: '治理',
    footer_rights: '© 2026 VOLTX. 保留所有权利。',
    footer_tos: '服务条款',
    footer_privacy: '隐私政策',
  },
};

const ElectricBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_30%,_rgba(0,255,157,0.12)_0%,_transparent_70%)]" />
    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.05)1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)1px,transparent_1px)] bg-[length:50px_50px]" />
  </div>
);

const HeroElectricFlow = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="absolute h-[1px] opacity-40 blur-[1px]"
        style={{
          top: `${10 + ((i * 7.7) % 80)}%`,
          left: '-200px',
          width: `${80 + (i % 3) * 40}px`,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0, 255, 157, 0.4) 50%, transparent 100%)',
          animation: `hero-electric-flow ${4 + (i % 5)}s linear infinite`,
          animationDelay: `${(i % 5) * -2}s`,
        }}
      />
    ))}
    <style jsx global>{`
      @keyframes hero-electric-flow {
        0% {
          transform: translateX(0);
          opacity: 0;
        }
        15% {
          opacity: 0.8;
        }
        85% {
          opacity: 0.8;
        }
        100% {
          transform: translateX(120vw);
          opacity: 0;
        }
      }
    `}</style>
  </div>
);

const Reveal = ({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
      }`}
    >
      {children}
    </div>
  );
};

const SciFiCard = ({
  icon: Icon,
  title,
  description,
  vt,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  vt: (key: string) => string;
  index: number;
}) => (
  <Reveal delay={index * 100}>
    <div className="relative group p-[1px] rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-cyber-green/40 transition-all duration-700 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-green/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-6 bg-black/60 backdrop-blur-xl rounded-[11px] h-full flex flex-col border border-white/5">
        <div className="mb-4">
          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-cyber-green group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(0,255,157,0.2)]">
            <Icon size={24} />
          </div>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:text-cyber-green transition-colors">
          {title}
        </h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1 font-sans">{description}</p>
        <div className="flex items-center gap-2 text-[10px] font-mono text-cyber-green/40 group-hover:text-cyber-green/80 transition-colors tracking-widest uppercase">
          <Activity size={10} /> {vt('operational_core')}
        </div>
      </div>
    </div>
  </Reveal>
);

const EnergyCore = () => (
  <div className="relative w-80 h-80 flex items-center justify-center">
    {/* Outer Atmosphere */}
    <div className="absolute inset-0 bg-cyber-green/10 blur-[100px] rounded-full animate-pulse" />

    {/* Orbiting Rings */}
    <div className="absolute inset-0 border border-cyber-green/10 rounded-full animate-[spin_25s_linear_infinite]" />
    <div className="absolute inset-8 border border-white/5 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
    <div className="absolute inset-16 border-t-2 border-l-2 border-cyber-green/20 rounded-full animate-[spin_15s_ease-in-out_infinite]" />

    {/* Inner Core */}
    <div className="relative w-48 h-48 bg-black/40 backdrop-blur-sm rounded-full border border-white/10 flex items-center justify-center overflow-hidden shadow-[inset_0_0_40px_rgba(0,255,157,0.1)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,157,0.15)_0%,transparent_70%)]" />
      <Zap
        size={96}
        className="text-cyber-green drop-shadow-[0_0_20px_rgba(0,255,157,0.6)] animate-[pulse_3s_ease-in-out_infinite]"
      />

      {/* Scanning Line */}
      <div className="absolute w-full h-[2px] bg-cyber-green/20 top-0 left-0 animate-[scan_4s_linear_infinite]" />
    </div>

    <style jsx>{`
      @keyframes scan {
        0% {
          transform: translateY(-50px);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translateY(250px);
          opacity: 0;
        }
      }
    `}</style>
  </div>
);

export default function LandingPage() {
  const [locale, setLocale] = useState<'en' | 'cn'>('cn');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const vt = (key: keyof typeof translations.en) => {
    return translations[locale][key] || translations.en[key] || key;
  };

  const handleEnter = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      window.location.href = 'http://localhost:7777/login';
    }, 800);
  };

  return (
    <div className="relative min-h-screen bg-[#020202] text-white selection:bg-cyber-green selection:text-black">
      <ElectricBackground />

      <nav className="fixed top-0 left-0 right-0 z-[999] bg-black/90 backdrop-blur-xl border-b border-white/5 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between font-sans">
          <div
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 relative overflow-hidden bg-cyber-green rounded-[4px] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,157,0.4)]">
              <Zap size={20} className="text-black fill-black" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic group-hover:tracking-widest transition-all duration-500">
              Voltx
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold tracking-widest text-white/60">
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
            <button
              onClick={() => setLocale(locale === 'en' ? 'cn' : 'en')}
              className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 text-[10px] font-bold tracking-widest text-white/70 hover:text-white transition-colors"
            >
              {locale === 'en' ? 'ZH' : 'EN'}
            </button>
            <button
              onClick={handleEnter}
              className="group overflow-hidden px-6 py-2 bg-white text-black font-bold uppercase text-[11px] tracking-widest rounded-[4px] hover:bg-cyber-green transition-colors duration-500 shadow-xl"
            >
              <span className="relative z-10 flex items-center gap-2">
                {vt('nav_access')} <ArrowUpRight size={14} />
              </span>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`transition-all duration-1000 ${isTransitioning ? 'scale-110 blur-2xl opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <main className="relative pt-16">
          {/* SECTION 1: HERO (STICKY) - High fidelity rescue */}
          <section id="vision" className="relative h-[100vh]">
            <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
              <HeroElectricFlow />
              <Reveal className="relative px-6 md:px-12 max-w-7xl mx-auto w-full z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                  <div className="lg:col-span-7 space-y-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-[10px] font-bold tracking-[0.2em]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping" />
                      {vt('hero_badge')}
                    </div>

                    <div className="space-y-4">
                      <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] text-white font-sans">
                        {vt('hero_title_1')} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-green to-[#00ffa3] italic pb-2 pr-4 inline-block">
                          {vt('hero_title_2')}
                        </span>
                      </h1>
                    </div>

                    <p className="text-lg md:text-xl text-gray-400 max-w-xl font-medium leading-relaxed font-sans">
                      {vt('hero_description')}
                    </p>

                    <div className="flex items-center gap-16 pt-10 border-t border-white/5">
                      <div className="space-y-2">
                        <div className="text-4xl font-black text-white tracking-tighter">99.9%</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                          {vt('uptime')}
                        </div>
                      </div>
                      <div className="w-px h-12 bg-white/10" />
                      <div className="space-y-2">
                        <div className="text-4xl font-black text-white tracking-tighter">~12ms</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                          {vt('latency')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 relative hidden lg:flex justify-center">
                    <EnergyCore />
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* SECTION 2: FEATURES (OVER HERO) */}
          <section
            id="core"
            className="relative z-20 bg-[#020202] shadow-[0_-50px_100px_rgba(0,0,0,0.9)] border-t border-white/10"
          >
            <div className="px-6 py-24 md:px-12 max-w-7xl mx-auto">
              <Reveal className="mb-20 space-y-4 text-center">
                <div className="text-cyber-green text-[10px] font-bold tracking-[0.3em] uppercase">
                  {vt('core_engine_capabilities')}
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic font-sans">
                  {vt('powered_by')}
                </h2>
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SciFiCard
                  icon={Cpu}
                  title={vt('feat_1_title')}
                  description={vt('feat_1_desc')}
                  vt={vt}
                  index={0}
                />
                <SciFiCard
                  icon={Brain}
                  title={vt('feat_2_title')}
                  description={vt('feat_2_desc')}
                  vt={vt}
                  index={1}
                />
                <SciFiCard
                  icon={Shield}
                  title={vt('feat_3_title')}
                  description={vt('feat_3_desc')}
                  vt={vt}
                  index={2}
                />
                <SciFiCard
                  icon={Activity}
                  title={vt('feat_4_title')}
                  description={vt('feat_4_desc')}
                  vt={vt}
                  index={3}
                />
                <SciFiCard
                  icon={LucideInfinity}
                  title={vt('feat_5_title')}
                  description={vt('feat_5_desc')}
                  vt={vt}
                  index={4}
                />{' '}
                <SciFiCard
                  icon={Database}
                  title={vt('feat_6_title')}
                  description={vt('feat_6_desc')}
                  vt={vt}
                  index={5}
                />
                <SciFiCard
                  icon={Globe}
                  title={vt('feat_7_title')}
                  description={vt('feat_7_desc')}
                  vt={vt}
                  index={6}
                />
                <SciFiCard
                  icon={Zap}
                  title={vt('feat_8_title')}
                  description={vt('feat_8_desc')}
                  vt={vt}
                  index={7}
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: CTA (STICKY REVEAL) */}
          <section id="security" className="relative h-[80vh] z-10">
            <div className="sticky bottom-0 h-screen w-full flex items-center justify-center bg-[#020202] overflow-hidden">
              <div className="absolute inset-0 bg-cyber-green/5 blur-[150px] rounded-full translate-y-1/2" />
              <Reveal className="relative px-6 py-12 md:px-12 max-w-4xl mx-auto w-full text-center">
                <div className="relative border border-white/10 bg-white/[0.03] rounded-3xl p-12 md:p-24 overflow-hidden border-t-cyber-green/20 shadow-2xl backdrop-blur-3xl font-sans">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent" />
                  <h2 className="text-5xl md:text-7xl font-black mb-12 tracking-tight italic">
                    {vt('cta_title_1')} <br />
                    <span className="text-cyber-green">{vt('cta_title_2')}</span>
                  </h2>
                  <button
                    onClick={handleEnter}
                    className="px-12 py-6 bg-white text-black font-bold uppercase text-[14px] tracking-[0.2em] rounded-[4px] hover:bg-cyber-green transition-all shadow-2xl active:scale-95 duration-200"
                  >
                    {vt('cta_sign_in')}
                  </button>
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="relative z-50 bg-black border-t border-white/5 pt-20 pb-10 font-sans">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
              <div className="col-span-1 md:col-span-2 space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-cyber-green rounded-[3px] flex items-center justify-center">
                    <Zap size={14} className="text-black fill-black" />
                  </div>
                  <span className="text-xl font-black tracking-tighter uppercase italic">
                    Voltx
                  </span>
                </div>
                <p className="text-gray-500 text-sm max-w-xs leading-relaxed font-medium">
                  {vt('footer_desc')}
                </p>
                <div className="flex gap-4">
                  {[Globe, Activity, Shield].map((Icon, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-cyber-green hover:border-cyber-green/30 transition-all cursor-pointer bg-white/5"
                    >
                      <Icon size={18} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-cyber-green">
                  {vt('footer_platform')}
                </h4>
                <ul className="space-y-3 text-xs font-bold text-white/50 tracking-widest uppercase">
                  <li>
                    <a href="#vision" className="hover:text-white transition-colors">
                      {vt('footer_neural_core')}
                    </a>
                  </li>
                  <li>
                    <a href="#core" className="hover:text-white transition-colors">
                      {vt('footer_quantum_grid')}
                    </a>
                  </li>
                  <li>
                    <a href="#security" className="hover:text-white transition-colors">
                      {vt('footer_security_shield')}
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-cyber-green">
                  {vt('footer_network')}
                </h4>
                <ul className="space-y-3 text-xs font-bold text-white/50 tracking-widest uppercase">
                  <li>
                    <a href="#" className="hover:text-white transition-colors">
                      {vt('footer_docs')}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">
                      {vt('footer_api')}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">
                      {vt('footer_gov')}
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
              <div className="text-[9px] font-bold tracking-[0.3em] uppercase">
                {vt('footer_rights')}
              </div>
              <div className="flex gap-8 text-[9px] font-bold tracking-[0.3em] uppercase">
                <a href="#" className="hover:text-cyber-green transition-colors">
                  {vt('footer_tos')}
                </a>
                <a href="#" className="hover:text-cyber-green transition-colors">
                  {vt('footer_privacy')}
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        :root {
          --cyber-green: #00ff9d;
        }
        body {
          background-color: #020202;
          margin: 0;
          padding: 0;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
