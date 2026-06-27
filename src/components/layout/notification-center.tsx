import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "./notification-item";
import {
  getUnreadNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/lib/notifications-api";

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const c = await getUnreadCount();
      setCount(c);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const list = await getUnreadNotifications(20);
      setNotifications(list);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setCount((prev) => Math.max(0, prev - 1));
  };

  const handleReadAll = async () => {
    await markAllNotificationsRead();
    setNotifications([]);
    setCount(0);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Уведомления"
          className="ring-focus relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-sm font-semibold">Уведомления</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleReadAll}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Прочитать все
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Нет новых уведомлений</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
