import React from 'react';
import ReactMarkdown from 'react-markdown';
import Typography from '@/components/ui/Typography';
import { CodeBlock } from './ChatParts';

type MarkdownComponents = NonNullable<React.ComponentProps<typeof ReactMarkdown>['components']>;
type MarkdownNodeProps = {
  children?: React.ReactNode;
};

export const getMarkdownComponents = (role: string): MarkdownComponents => ({
  p: ({ children }: MarkdownNodeProps) => (
    <Typography
      variant="body"
      as="div"
      color={role === 'assistant' ? 'inherit' : 'primary'}
      className="block mb-1 last:mb-0 break-words"
    >
      {children}
    </Typography>
  ),
  h1: ({ children }: MarkdownNodeProps) => (
    <Typography
      variant="h3"
      color={role === 'assistant' ? 'inherit' : 'primary'}
      className="block mt-4 mb-2 text-cyber-green"
      glow
    >
      {children}
    </Typography>
  ),
  h2: ({ children }: MarkdownNodeProps) => (
    <Typography
      variant="h3"
      color={role === 'assistant' ? 'inherit' : 'primary'}
      className="block mt-3 mb-1 text-cyber-green/90"
    >
      {children}
    </Typography>
  ),
  h3: ({ children }: MarkdownNodeProps) => (
    <Typography
      variant="body"
      weight="bold"
      color={role === 'assistant' ? 'inherit' : 'primary'}
      className="block mt-2 mb-1 text-cyber-green/80"
    >
      {children}
    </Typography>
  ),
  ul: ({ children }: MarkdownNodeProps) => (
    <ul className="list-disc pl-5 mb-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: MarkdownNodeProps) => (
    <ol className="list-decimal pl-5 mb-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: MarkdownNodeProps) => (
    <li>
      <Typography
        variant="body"
        as="div"
        color={role === 'assistant' ? 'inherit' : 'primary'}
        className="inline"
      >
        {children}
      </Typography>
    </li>
  ),
  code: ({ children, className }: React.ComponentProps<'code'>) => {
    const inline = !className?.includes('language-');
    if (inline) {
      return (
        <code className="bg-foreground/5 px-1 rounded font-mono text-sm text-cyber-green/100">
          {children}
        </code>
      );
    }
    return <CodeBlock>{String(children).replace(/\n$/, '')}</CodeBlock>;
  },
  strong: ({ children }: { children?: React.ReactNode }) => (
    <Typography
      variant="body"
      as="span"
      weight="bold"
      color={role === 'assistant' ? 'inherit' : 'primary'}
      className="inline font-bold"
    >
      {children}
    </Typography>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyber-green hover:text-cyber-green/80 underline decoration-cyber-green/30 underline-offset-4 transition-colors font-medium"
    >
      {children}
    </a>
  ),
});
