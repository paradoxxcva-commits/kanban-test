import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageSquare, CheckSquare, AlertTriangle, Bell, Clock, Calendar } from "lucide-react";
import type { Notification } from "@/lib/notifications-api";

const TYPE_ICON: Record<Notification["type"], typeof MessageSquare> = {
  message: MessageSquare,
  task_assigned: CheckSquare,
  task_due_soon: AlertTriangle,
  comment: MessageSquare,
  reminder: Clock,
  calendar_event: Calendar,
};

const TYPE_LABEL: Record<Notification["type"], string> = {
  message: "Сообщение",
  task_assigned: "Назначена задача",
  task_due_soon: "Срок задачи",
  comment: "Комментарий",
  reminder: "Напоминание",
  calendar_event: "Событие",
};

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ru,
  });

  const content = (
    <div
      className={`flex gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent ${
        !notification.is_read ? "bg-accent/50" : ""
      }`}
      onClick={() => onRead(notification.id)}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        !notification.is_read ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {TYPE_LABEL[notification.type]}
          </span>
          {!notification.is_read && (
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground truncate">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link to={notification.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
