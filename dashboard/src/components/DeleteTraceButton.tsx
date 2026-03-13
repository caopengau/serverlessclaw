'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface DeleteTraceButtonProps {
  traceId: string;
}

export default function DeleteTraceButton({ traceId }: DeleteTraceButtonProps) {
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this neural trace?')) return;

    try {
      const response = await fetch(`/api/trace?traceId=${traceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Neural trace deleted');
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(`Failed to delete trace: ${error.error}`);
      }
    } catch (error) {
      console.error('Delete trace error:', error);
      toast.error('Failed to delete trace.');
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="p-2 opacity-0 group-hover:opacity-40 hover:!opacity-100 text-white transition-all hover:text-red-500 z-10"
      title="Delete Trace"
    >
      <Trash2 size={16} />
    </button>
  );
}
