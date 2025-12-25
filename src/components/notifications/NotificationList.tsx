import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageCircle, CheckCircle, AlertCircle } from "lucide-react";
import type { Notification } from "@/lib/types";

interface NotificationListProps {
  notifications: Notification[];
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'status_update':
      return <CheckCircle className="h-4 w-4 text-success" />;
    case 'comment':
      return <MessageCircle className="h-4 w-4 text-info" />;
    case 'alert':
      return <AlertCircle className="h-4 w-4 text-warning" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

export const NotificationList = ({ notifications }: NotificationListProps) => {
  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No new notifications.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="flex flex-col">
        <div className="p-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            to={notification.problem_id ? `/problem/${notification.problem_id}` : '#'}
            className={`
              block p-3 border-b transition-colors
              ${notification.is_read ? 'hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'}
            `}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">
                    {notification.message || 'New notification'}
                  </p>
                  {!notification.is_read && (
                    <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </ScrollArea>
  );
};
