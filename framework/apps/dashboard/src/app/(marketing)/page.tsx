'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Terminal } from 'lucide-react';

/**
 * Framework Generic Landing Page
 *
 * This is the default entry point for the ServerlessClaw framework.
 * It is designed to be brand-agnostic and strictly OSS.
 */
export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyber-green/10 flex items-center justify-center mb-8 border border-cyber-green/20">
        <Terminal className="text-cyber-green" size={32} />
      </div>

      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
        ServerlessClaw
      </h1>

      <p className="text-muted max-w-lg mb-12 text-sm md:text-base leading-relaxed">
        The AI-native autonomous orchestration framework. Highly modular, strictly serverless, and
        ready for deployment.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/login"
          className="px-8 py-3 bg-foreground text-background font-bold uppercase text-xs tracking-widest rounded-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          Enter Dashboard <ArrowRight size={14} />
        </Link>
        <a
          href="https://github.com/serverlessclaw"
          target="_blank"
          className="px-8 py-3 border border-border text-foreground font-bold uppercase text-xs tracking-widest rounded-sm hover:bg-foreground/5 transition-colors"
        >
          Documentation
        </a>
      </div>

      <div className="mt-24 pt-8 border-t border-border w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 text-left opacity-60">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-cyber-green">
            Core
          </div>
          <p className="text-xs">Event-driven agent orchestration with multi-cloud support.</p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-cyber-green">
            Registry
          </div>
          <p className="text-xs">Dynamic tool discovery and capability mapping for LLMs.</p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-cyber-green">
            Shield
          </div>
          <p className="text-xs">Safety-first tool execution engine with policy enforcement.</p>
        </div>
      </div>
    </div>
  );
}
