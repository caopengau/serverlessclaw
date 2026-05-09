/**
 * Visual constants and style configurations for the Chat component.
 */
export const CHAT_STYLES = {
  GRADIENTS: {
    MAIN_BG:
      'bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-green/5 via-background to-background',
    DRAG_OVER: 'bg-cyber-green/10',
  },
  SHADOWS: {
    DROP_ZONE: 'shadow-[0_0_50px_rgba(0,255,163,0.2)]',
  },
  ANIMATIONS: {
    PULSE: 'animate-pulse',
    BOUNCE: 'animate-bounce',
  },
} as const;
