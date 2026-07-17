export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  relatedCommunityId: string | null;
  relatedApplicationId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};
