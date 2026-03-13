'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Typography from './ui/Typography';
import Button from './ui/Button';

interface CyberConfirmProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function CyberConfirm({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm Action',
  cancelText = 'Abort Operation',
  variant = 'warning'
}: CyberConfirmProps) {
  if (!isOpen) return null;

  const colors = {
    danger: 'red',
    warning: 'yellow',
    info: 'blue'
  };

  const color = colors[variant];

  return (
    <div className="fixed inset-0 z-[200] w-screen h-screen flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-hidden">
      <div className="absolute inset-0 w-full h-full bg-black/80 backdrop-blur-md" onClick={onCancel} />
      
      <div className={`relative w-full max-w-md bg-[#050505] border-2 border-${color}-500/30 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm p-8 space-y-6 overflow-hidden`}>
        {/* Cyber background decoration */}
        <div className={`absolute top-0 right-0 p-2 opacity-5 pointer-events-none`}>
           <AlertTriangle size={120} className={`text-${color}-500`} />
        </div>

        <div className="flex flex-col items-center text-center space-y-4 relative">
          <div className={`w-16 h-16 bg-${color}-500/10 rounded-full flex items-center justify-center text-${color}-500 shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-${color}-500/20`}>
            <AlertTriangle size={32} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <Typography variant="h3" weight="black" className="tracking-[0.2em] italic">
              {title}
            </Typography>
            <Typography variant="caption" color="muted" className="leading-relaxed tracking-widest block">
              {message}
            </Typography>
          </div>
        </div>

        <div className="flex flex-col gap-3 relative">
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            onClick={onConfirm}
            className="tracking-[0.3em] font-black"
          >
            {confirmText}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={onCancel}
            icon={<X size={12} />}
            className="text-white/40 border border-white/5 font-bold tracking-[0.3em]"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
}
