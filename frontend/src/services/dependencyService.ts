import { api } from "./api";
import { type Task } from "./taskService";

export interface DependencyGraphNode {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "BLOCKED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  due_date?: string | null;
  dependencies: string[];
  level: number;
  duration_days: number;
  // Dynamic layout coordinates for interactive visualizer
  x?: number;
  y?: number;
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  is_critical_path: boolean;
}

export interface DependencyGraphResponse {
  project_id: string;
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  critical_path_task_ids: string[];
  critical_path_length: number;
  has_cycles: boolean;
}

export interface HealthFactorDetail {
  name: string;
  weight: number;
  raw_percentage: number;
  weighted_score: number;
  description: string;
}

export interface HealthMetricBreakdown {
  project_id: string;
  total_health_score: number;
  health_status: "EXCELLENT" | "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
  completion_pct: number;
  ontime_pct: number;
  unblocked_pct: number;
  activity_score: number;
  factors: HealthFactorDetail[];
  suggestions: string[];
  evaluated_at: string;
}

export interface CumulativeFlowDataPoint {
  date: string;
  todo: number;
  in_progress: number;
  in_review: number;
  completed: number;
  blocked: number;
}

export interface MemberWorkloadItem {
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  total_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  critical_priority_tasks: number;
  workload_status: "OPTIMAL" | "BALANCED" | "OVERLOADED" | "IDLE";
}

export interface MilestoneTimelineItem {
  id: string;
  title: string;
  status: string;
  target_date?: string | null;
  progress: number;
  task_count: number;
}

export interface AdvancedAnalyticsResponse {
  project_id: string;
  health: HealthMetricBreakdown;
  cumulative_flow: CumulativeFlowDataPoint[];
  team_workload: MemberWorkloadItem[];
  milestones: MilestoneTimelineItem[];
}

export const dependencyService = {
  /**
   * Fetch project DAG dependency graph with calculated critical path.
   */
  async getDependencyGraph(projectId: string): Promise<DependencyGraphResponse> {
    const res = await api.get<DependencyGraphResponse>(`/api/projects/${projectId}/dependency-graph`);
    return res.data;
  },

  /**
   * Add prerequisite dependency with algorithmic cycle prevention.
   */
  async addDependency(taskId: string, prerequisiteId: string): Promise<Task> {
    const res = await api.post<Task>(`/api/tasks/${taskId}/dependencies`, {
      prerequisite_id: prerequisiteId,
    });
    return res.data;
  },

  /**
   * Remove a prerequisite dependency.
   */
  async removeDependency(taskId: string, prerequisiteId: string): Promise<Task> {
    const res = await api.delete<Task>(`/api/tasks/${taskId}/dependencies/${prerequisiteId}`);
    return res.data;
  },

  /**
   * Get composite project health metric and suggestions.
   */
  async getProjectHealth(projectId: string): Promise<HealthMetricBreakdown> {
    const res = await api.get<HealthMetricBreakdown>(`/api/projects/${projectId}/health`);
    return res.data;
  },

  /**
   * Get high-resolution advanced analytics (cumulative flow, workload, milestones).
   */
  async getAdvancedMetrics(projectId: string): Promise<AdvancedAnalyticsResponse> {
    const res = await api.get<AdvancedAnalyticsResponse>(`/api/projects/${projectId}/advanced-metrics`);
    return res.data;
  },
};
