import { api } from "./api";

export interface SummaryMetrics {
  total_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  overall_completion_rate: number;
}

export interface ProjectProgressSummary {
  id: string;
  name: string;
  status: string;
  progress: number;
  total_tasks: number;
  completed_tasks: number;
}

export interface DistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface UpcomingTaskItem {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  priority: string;
  status: string;
  due_date: string;
  is_overdue: boolean;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  user_name: string;
  project_name?: string | null;
}

export interface WeeklyTrendItem {
  day: string;
  completed: number;
  created: number;
}

export interface DashboardAnalyticsResponse {
  summary: SummaryMetrics;
  project_progress: ProjectProgressSummary[];
  status_distribution: DistributionItem[];
  priority_distribution: DistributionItem[];
  upcoming_deadlines: UpcomingTaskItem[];
  recent_activities: ActivityItem[];
  weekly_trends: WeeklyTrendItem[];
}

export const analyticsService = {
  /**
   * Fetch live dashboard analytics and aggregation metrics.
   */
  async getDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
    const response = await api.get<DashboardAnalyticsResponse>("/api/analytics/dashboard");
    return response.data;
  },
};
