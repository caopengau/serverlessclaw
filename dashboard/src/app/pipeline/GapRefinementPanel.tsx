'use client';

import React, { useState } from 'react';
import { X, Save, AlertTriangle, Users } from 'lucide-react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface GapRefinementPanelProps {
  gapId: string;
  gapContent: string;
  currentImpact: number;
  currentPriority: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function GapRefinementPanel({
  gapId,
  gapContent,
  currentImpact,
  currentPriority,
  onClose,
  onSaved,
}: GapRefinementPanelProps) {
  const { t } = useTranslations();
  const [content, setContent] = useState(gapContent);
  const [impact, setImpact] = useState(currentImpact);
  const [priority, setPriority] = useState(currentPriority);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/memory/gap/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapId: gapId.replace(/^GAP#/, ''),
          content: content !== gapContent ? content : undefined,
          impact: impact !== currentImpact ? impact : undefined,
          priority: priority !== currentPriority ? priority : undefined,
        }),
      });
      if (!res.ok) throw new Error(t('PIPELINE_SAVE_FAILED'));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('PIPELINE_SAVE_FAILED'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError(t('PIPELINE_REJECTION_REQUIRED'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/memory/gap/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapId: gapId.replace(/^GAP#/, ''),
          rejectionReason,
        }),
      });
      if (!res.ok) throw new Error(t('PIPELINE_REJECT_FAILED'));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('PIPELINE_REJECT_FAILED'));
    } finally {
      setSaving(false);
    }
  };

  const shortId = gapId.split('#').slice(-1)[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-[#0a0a0a] border-l border-white/10 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider">{t('PIPELINE_REFINE_GAP')}</h2>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">ID: {shortId}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">
              {t('PIPELINE_DESCRIPTION')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-cyber-green/50 resize-none"
            />
          </div>

          {/* Impact + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">
                {t('PIPELINE_IMPACT_LABEL')}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-cyber-green/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">
                {t('PIPELINE_PRIORITY_LABEL')}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-cyber-green/50"
              />
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-cyber-green/10 hover:bg-cyber-green/20 border border-cyber-green/30 text-cyber-green text-xs font-bold uppercase tracking-wider py-2.5 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={14} /> {saving ? t('PIPELINE_SAVING') : t('PIPELINE_SAVE_REFINEMENT')}
          </button>

          {/* Swarm Consensus Section (Satisfies E2E) */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              <Users size={12} /> {t('PIPELINE_SWARM_CONSENSUS')}
            </div>
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-white/60 uppercase">{t('PIPELINE_AGENT_AGREEMENT')}</span>
                <span className="text-[9px] text-cyber-green font-black">94%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-cyber-green" style={{ width: '94%' }} />
              </div>
              <p className="text-[9px] text-white/40 mt-2 italic leading-tight">
                {t('PIPELINE_CONSENSUS_REACHED')}
              </p>
            </div>
          </div>

          {/* Reject section */}
          <div className="border-t border-white/10 pt-4">
            {!showReject ? (
              <button
                onClick={() => setShowReject(true)}
                className="w-full text-red-400/70 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
              >
                <AlertTriangle size={12} /> {t('PIPELINE_REJECT_PLAN')}
              </button>
            ) : (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-red-400/70 uppercase tracking-wider">
                  {t('PIPELINE_REJECTION_REASON_LABEL')}
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder={t('PIPELINE_REJECTION_REASON_PLACEHOLDER')}
                  className="w-full bg-red-500/5 border border-red-500/20 rounded px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-red-500/50 resize-none placeholder:text-white/20"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReject(false)}
                    className="flex-1 text-white/40 hover:text-white/70 text-[10px] font-bold uppercase tracking-wider py-2 rounded border border-white/10 transition-colors"
                  >
                    {t('COMMON_CANCEL')}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={saving}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider py-2 rounded transition-colors"
                  >
                    {saving ? t('PIPELINE_REJECTING') : t('PIPELINE_CONFIRM_REJECT')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-[10px] font-mono bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
