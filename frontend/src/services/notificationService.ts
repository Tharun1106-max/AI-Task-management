import { api } from "./api";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unread_count: number;
  total: number;
}

export const notificationService = {
  /**
   * Fetch in-app notifications with unread items prioritized.
   */
  async getNotifications(params?: { page?: number; limit?: number }): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>("/api/notifications", { params });
    return response.data;
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>(`/api/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>("/api/notifications/read-all");
    return response.data;
  },
};
