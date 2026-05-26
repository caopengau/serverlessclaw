'use client';

import React, { useState } from 'react';
import { Lock, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

export default function LoginPage() {
  const { t } = useTranslations();
  const logoSrc = process.env.NEXT_PUBLIC_APP_LOGO;
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim() || 'dashboard-user', password }),
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error ?? 'ACCESS_DENIED // SHA256_MISMATCH');
      }
    } catch {
      setError('NEURAL_LINK_FAILURE');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-100 font-mono overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyber-green rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyber-blue rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md p-8 glass-card border-white/10 relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          {logoSrc ? (
            <div className="mb-6">
              <Image
                src={logoSrc}
                alt={process.env.NEXT_PUBLIC_APP_NAME || 'App Logo'}
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-cyber-green/10 rounded-sm flex items-center justify-center text-cyber-green mb-4 border border-cyber-green/30">
                <Lock size={32} />
              </div>
              <Typography variant="h1" color="primary" glow uppercase className="mb-2">
                {t('LOGIN_TITLE')}
              </Typography>
            </>
          )}
          <Typography variant="mono" color="muted" uppercase>
            {t('LOGIN_RESTRICTED_ACCESS')}
          </Typography>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2" suppressHydrationWarning>
            <label className="text-[10px] text-white font-bold uppercase tracking-widest block ml-1">
              {t('LOGIN_USER_IDENTITY')}
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-white/3 border border-white/10 rounded px-4 py-3 outline-none focus:border-cyber-green/50 transition-all text-sm font-mono placeholder:text-white/10"
              placeholder={t('LOGIN_USER_ID_PLACEHOLDER')}
              disabled={loading}
            />
          </div>

          <div className="space-y-2" suppressHydrationWarning>
            <label className="text-[10px] text-white font-bold uppercase tracking-widest block ml-1">
              {t('LOGIN_KEYPHRASE')}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/3 border border-white/10 rounded px-4 py-3 outline-none focus:border-cyber-green/50 transition-all text-sm font-mono placeholder:text-white/10"
                placeholder={t('LOGIN_PASSPHRASE_PLACEHOLDER')}
                disabled={loading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Zap
                  size={16}
                  className={loading ? 'text-cyber-green animate-pulse' : 'text-white/50'}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
            size="lg"
            icon={
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            }
            className="flex-row-reverse"
          >
            {loading ? t('LOGIN_SYNCHRONIZING') : t('LOGIN_INITIALIZE_LINK')}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[9px] text-white/50 font-bold tracking-widest">
          <span>{t('LOGIN_FOOTER_OS')}</span>
          <span>{t('LOGIN_FOOTER_YEAR')}</span>
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-3 text-[9px] text-white/40 text-center font-mono tracking-wide">
            Local dev fallback keyphrase: test-password
          </div>
        )}
      </div>
    </div>
  );
}
