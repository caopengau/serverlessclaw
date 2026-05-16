'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useTenant } from '@/components/Providers/TenantProvider';
import { useRealtimeContext, RealtimeMessage } from '@/components/Providers/RealtimeProvider';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import { Notification } from '@claw/core/lib/types/notification';
import { toast } from 'sonner';

/**
 * NotificationBell component that manages and displays cross-session shared resources.
 * Listens for real-time signals and fetches unread notifications from the backend.
 */
export default function NotificationBell() {
  const { activeWorkspaceId } = useTenant();
  const { subscribe, isLive } = useRealtimeContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!activeWorkspaceId) return;
      try {
        const res = await fetch(
          `/api/notifications?workspaceId=${activeWorkspaceId}&unreadOnly=true`
        );
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setNotifications(data.notifications || []);
      } catch (e) {
        console.error('[NotificationBell] Failed to fetch notifications:', e);
      }
    };

    fetchNotifications();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!isLive || !activeWorkspaceId) return;

    // Subscribe to workspace-level signals for notifications
    const unsubscribe = subscribe(
      [`workspaces/${activeWorkspaceId}/signal`],
      (topic: string, message: RealtimeMessage) => {
        if (message['detail-type'] === 'notification.created') {
          const newNotif = message.detail as unknown as Notification;

          setNotifications((prev) => {
            // Avoid duplicate notifications in the local state
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // Show a visual toast for immediate feedback
          toast(`Intel from ${newNotif.senderName}`, {
            description: newNotif.content,
            action: {
              label: 'View',
              onClick: () => {
                if (newNotif.sessionId) {
                  window.location.href = `/chat?sessionId=${newNotif.sessionId}&messageId=${newNotif.resourceId}`;
                }
              },
            },
          });
        }
      }
    );

    return () => unsubscribe();
  }, [isLive, activeWorkspaceId, subscribe]);

  const markAsRead = async (timestamp: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceId: activeWorkspaceId, timestamp }),
      });
      setNotifications((prev) => prev.filter((n) => n.timestamp !== timestamp));
    } catch (e) {
      console.error('[NotificationBell] Failed to mark as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceId: activeWorkspaceId, all: true }),
      });
      setNotifications([]);
    } catch (e) {
      console.error('[NotificationBell] Failed to mark all as read:', e);
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-all relative ${
          isOpen
            ? 'bg-cyber-blue/10 text-cyber-blue'
            : 'text-muted-foreground hover:text-cyber-green hover:bg-foreground/5'
        }`}
        title="Collaboration Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-cyber-blue text-black text-[9px] font-black rounded-full flex items-center justify-center animate-pulse border border-background shadow-[0_0_8px_rgba(0,143,255,0.5)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Invisible Backdrop for click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-3 w-80 glass-card border-border shadow-premium z-50 overflow-hidden bg-card/95 backdrop-blur-xl animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-border flex items-center justify-between bg-foreground/5">
              <Typography
                variant="mono"
                weight="black"
                className="text-[10px] uppercase tracking-widest opacity-60"
              >
                Shared_Intel
              </Typography>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                  className="text-[9px] font-bold text-cyber-blue hover:text-cyber-green uppercase transition-colors"
                >
                  Clear_All
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 text-center opacity-40">
                  <Bell size={32} className="mx-auto mb-3 opacity-10" />
                  <Typography variant="caption" className="text-[10px] uppercase tracking-wider">
                    No pending transmissions
                  </Typography>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-4 hover:bg-cyber-blue/5 transition-colors group relative"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <Typography
                          variant="mono"
                          weight="bold"
                          className="text-cyber-blue text-[9px] uppercase tracking-tighter"
                        >
                          {notif.type.replace('SHARE_', 'INCOMING_')}
                        </Typography>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.timestamp);
                          }}
                          className="p-1 text-muted-foreground hover:text-cyber-green transition-colors"
                          title="Acknowledge"
                        >
                          <Check size={14} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-cyber-blue/20 flex items-center justify-center text-[10px] font-black text-cyber-blue">
                          {notif.senderName.charAt(0)}
                        </div>
                        <Typography variant="caption" weight="bold" className="text-xs">
                          {notif.senderName}
                        </Typography>
                      </div>

                      <div className="bg-foreground/5 p-2.5 rounded border border-border/40 mb-3 text-[11px] text-foreground/80 leading-relaxed font-mono">
                        {notif.content}
                      </div>

                      {notif.resourceId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-[9px] h-8 gap-2 bg-cyber-blue/5 hover:bg-cyber-blue/10 border-cyber-blue/10 font-black uppercase tracking-wider"
                          onClick={() => {
                            if (notif.sessionId) {
                              window.location.href = `/chat?sessionId=${notif.sessionId}&messageId=${notif.resourceId}`;
                            }
                          }}
                        >
                          <ExternalLink size={10} />
                          Trace_{notif.resourceType}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-2 bg-foreground/5 border-t border-border flex justify-center">
              <Typography variant="mono" className="text-[8px] opacity-20 uppercase">
                Collaboration_Node_Active
              </Typography>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
