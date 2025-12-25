import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, BellRing } from "lucide-react";
import { NotificationList } from "./NotificationList";
import type { Notification } from "@/lib/types";

const fetchNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  
  // Map the data to match the Notification type
  return (data || []).map(item => ({
    id: item.id,
    user_id: item.user_id,
    sender_id: item.sender_id,
    problem_id: item.problem_id,
    comment_id: item.comment_id,
    type: item.type,
    message: item.message,
    is_read: item.is_read ?? false,
    created_at: item.created_at,
  }));
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["notifications", user?.id];

  const { data: notifications } = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: number[]) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", notificationIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && unreadCount > 0) {
      const unreadIds = notifications?.filter((n) => !n.is_read).map((n) => n.id) ?? [];
      if (unreadIds.length > 0) {
        markAsReadMutation.mutate(unreadIds);
      }
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 text-primary animate-pulse" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <NotificationList notifications={notifications ?? []} />
      </PopoverContent>
    </Popover>
  );
};
