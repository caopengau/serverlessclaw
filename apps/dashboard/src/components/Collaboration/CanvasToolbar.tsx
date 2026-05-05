import React from 'react';
import { Plus, Minus, Maximize, Lock, User } from 'lucide-react';
import Button from '@/components/ui/Button';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  isHumanActive: boolean;
  onToggleHumanActive: () => void;
  t: (key: string) => string;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  isHumanActive,
  onToggleHumanActive,
  t,
}) => {
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      <div className="bg-card-elevated border border-border p-1 rounded-md flex flex-col gap-1 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          icon={<Plus size={14} />}
          className="!p-1.5 h-8 w-8"
          title={t('ZOOM_IN')}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          icon={<Minus size={14} />}
          className="!p-1.5 h-8 w-8"
          title={t('ZOOM_OUT')}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onFitView}
          icon={<Maximize size={14} />}
          className="!p-1.5 h-8 w-8 border-t border-border !rounded-none"
          title={t('FIT_VIEW')}
        />
      </div>

      <div className="bg-card-elevated border border-border p-1 rounded-md shadow-lg">
        <Button
          variant={isHumanActive ? 'primary' : 'ghost'}
          size="sm"
          onClick={onToggleHumanActive}
          icon={isHumanActive ? <User size={14} /> : <Lock size={14} />}
          className={`h-8 px-3 text-[10px] uppercase font-bold tracking-widest ${
            isHumanActive ? 'animate-pulse' : 'text-muted-foreground'
          }`}
        >
          {isHumanActive ? t('COLLAB_HUMAN_ACTIVE') : t('COLLAB_HUMAN_IDLE')}
        </Button>
      </div>
    </div>
  );
};
