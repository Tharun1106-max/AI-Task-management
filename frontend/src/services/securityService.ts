import { api } from "./api";

export interface AIUsageLogItem {
  id: string;
  endpoint: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms?: number | null;
  created_at: string;
}

export interface FeatureUsageStat {
  feature: string;
  display_name: string;
  request_count: number;
  total_tokens: number;
  pct_of_total: number;
}

export interface AIUsageSummaryResponse {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  daily_tokens_used: number;
  daily_token_quota: number;
  quota_used_pct: number;
  feature_breakdown: FeatureUsageStat[];
  recent_logs: AIUsageLogItem[];
}

export const securityService = {
  /**
   * Fetch user AI token usage summary, daily quota progress, and feature breakdown.
   */
  async getAIUsage(): Promise<AIUsageSummaryResponse> {
    const res = await api.get<AIUsageSummaryResponse>("/api/ai/usage");
    return res.data;
  },

  /**
   * Securely change user password.
   */
  async changePassword(payload: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    const res = await api.put<{ success: boolean; message: string }>("/api/users/password", payload);
    return res.data;
  },

  /**
   * Download full project archive as JSON.
   */
  async exportProject(projectId: string): Promise<Record<string, any>> {
    const res = await api.get<Record<string, any>>(`/api/projects/${projectId}/export`);
    return res.data;
  },
};
