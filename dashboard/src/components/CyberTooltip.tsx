'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Info } from 'lucide-react';
import { createPortal } from 'react-dom';

interface CyberTooltipProps {
  content: string | React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showIcon?: boolean;
  className?: string;
}

export default function CyberTooltip({
  content,
  children,
  position = 'top',
  showIcon = true,
  className = '',
}: CyberTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      const margin = 8; // Small gap between trigger and tooltip

      switch (position) {
        case 'top':
          top = rect.top - margin;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - margin;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + margin;
          break;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords({ top, left });
    }
  }, [isVisible, position]);

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const getArrowStyles = () => {
    switch (position) {
      case 'top':
        return {
          bottom: '-4px',
          left: 'calc(50% - 4px)',
          borderRight: '1px solid hsl(var(--border))',
          borderBottom: '1px solid hsl(var(--border))',
        };
      case 'bottom':
        return {
          top: '-4px',
          left: 'calc(50% - 4px)',
          borderLeft: '1px solid hsl(var(--border))',
          borderTop: '1px solid hsl(var(--border))',
        };
      case 'left':
        return {
          right: '-4px',
          top: 'calc(50% - 4px)',
          borderLeft: '1px solid hsl(var(--border))',
          borderBottom: '1px solid hsl(var(--border))',
          transform: 'rotate(-135deg)',
        };
      case 'right':
        return {
          left: '-4px',
          top: 'calc(50% - 4px)',
          borderLeft: '1px solid hsl(var(--border))',
          borderTop: '1px solid hsl(var(--border))',
          transform: 'rotate(-45deg)',
        };
      default:
        return {};
    }
  };

  const tooltipContent = (
    <div
      className={`fixed z-[9999] w-64 p-3 bg-background/95 border border-border rounded shadow-2xl text-[10px] leading-relaxed text-foreground/90 backdrop-blur-md animate-in fade-in zoom-in duration-200 pointer-events-none ${positionClasses[position]}`}
      style={{
        top: coords.top,
        left: coords.left,
      }}
    >
      {content}
      <div
        className="absolute w-2 h-2 bg-background border-border rotate-45"
        style={getArrowStyles()}
      />
    </div>
  );

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block group ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children ? (
        children
      ) : showIcon ? (
        <Info size={12} className="text-muted-foreground hover:text-foreground/80 transition-colors cursor-help ml-1" />
      ) : null}

      {isVisible && mounted && content && createPortal(tooltipContent, document.body)}
    </div>
  );
}
