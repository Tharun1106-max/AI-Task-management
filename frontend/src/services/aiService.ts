import { api } from "./api";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
}

export interface PlanMilestone {
  id: string;
  title: string;
  description: string;
  target_week: number;
}

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  milestone_id?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimated_days: number;
  dependencies: string[];
  tags: string[];
}

export interface ProjectPlanResponse {
  title: string;
  description: string;
  suggested_tags: string[];
  milestones: PlanMilestone[];
  tasks: PlanTask[];
  token_usage?: TokenUsage | null;
}

export interface ProjectPlanRequest {
  idea_prompt: string;
  domain?: string;
  estimated_duration_weeks?: number;
}

export interface GeneratedTaskItem {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  tags: string[];
  estimated_hours?: number;
}

export interface GenerateTasksResponse {
  tasks: GeneratedTaskItem[];
  token_usage?: TokenUsage | null;
}

export interface GenerateTasksRequest {
  prompt: string;
  project_id?: string;
  project_context?: string;
  count?: number;
}

export interface PrioritizedTaskItem {
  task_id: string;
  title: string;
  recommended_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgency_rank: number;
  category_tag: "Urgent Blocker" | "Approaching Deadline" | "Low Impact" | string;
  rationale: string;
}

export interface PrioritizeResponse {
  ranked_tasks: PrioritizedTaskItem[];
  strategic_advice: string;
  token_usage?: TokenUsage | null;
}

export interface PrioritizeRequest {
  project_id?: string;
  task_ids?: string[];
  current_bottlenecks?: string;
  target_deadline?: string;
}

export interface SummarizeProjectResponse {
  project_title: string;
  executive_summary: string;
  completed_wins: string[];
  current_roadblocks: string[];
  next_recommended_actions: string[];
  health_score: number;
  token_usage?: TokenUsage | null;
}

export interface ApplyPlanTask {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  tags?: string[];
}

export interface ApplyPlanRequest {
  project_id?: string;
  project_name?: string;
  project_description?: string;
  tags?: string[];
  tasks: ApplyPlanTask[];
}

export interface ApplyPlanResponse {
  success: boolean;
  project_id: string;
  created_tasks_count: number;
  message: string;
}

export interface IdentifiedRiskItem {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_category: "BOTTLENECK" | "DEADLINE_SLIPPAGE" | "RESOURCE_OVERLOAD" | string;
  affected_task_ids: string[];
  affected_task_titles: string[];
  suggested_action: string;
  one_click_fix_type?: "AUTO_REASSIGN" | "CLEAR_BLOCKER" | "ESCALATE_PRIORITY" | string | null;
}

export interface RiskAnalysisResponse {
  project_id: string;
  overall_risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary_assessment: string;
  identified_risks: IdentifiedRiskItem[];
  metrics_snapshot?: Record<string, any>;
  token_usage?: TokenUsage | null;
}

export interface ApplyRiskFixRequest {
  project_id: string;
  risk_id: string;
  fix_type: string;
  task_ids: string[];
}

export interface ApplyRiskFixResponse {
  success: boolean;
  message: string;
  updated_tasks_count: number;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReferencedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export interface AssistantRequest {
  message: string;
  project_id?: string;
  history?: AssistantMessage[];
}

export interface AssistantResponse {
  answer: string;
  referenced_tasks: ReferencedTask[];
  suggested_followups: string[];
  token_usage?: TokenUsage | null;
}

export interface MeetingActionItem {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  suggested_assignee?: string | null;
  due_date?: string | null;
  tags: string[];
}

export interface MeetingNotesResponse {
  meeting_title: string;
  summary: string;
  key_decisions: string[];
  action_items: MeetingActionItem[];
  token_usage?: TokenUsage | null;
}

export const aiService = {
  /**
   * Synthesize full project roadmap with milestones and tasks.
   */
  async generateProjectPlan(payload: ProjectPlanRequest): Promise<ProjectPlanResponse> {
    const res = await api.post<ProjectPlanResponse>("/api/ai/project-plan", payload);
    return res.data;
  },

  /**
   * Quick-decompose a feature into granular task cards.
   */
  async generateTasks(payload: GenerateTasksRequest): Promise<GenerateTasksResponse> {
    const res = await api.post<GenerateTasksResponse>("/api/ai/generate-tasks", payload);
    return res.data;
  },

  /**
   * Evaluate task queue and prioritize based on deadlines and bottlenecks.
   */
  async prioritizeTasks(payload: PrioritizeRequest): Promise<PrioritizeResponse> {
    const res = await api.post<PrioritizeResponse>("/api/ai/prioritize", payload);
    return res.data;
  },

  /**
   * Generate an executive status briefing for a project.
   */
  async summarizeProject(projectId: string): Promise<SummarizeProjectResponse> {
    const res = await api.post<SummarizeProjectResponse>("/api/ai/summarize", {
      project_id: projectId,
    });
    return res.data;
  },

  /**
   * Persist approved AI plan to MongoDB.
   */
  async applyPlan(payload: ApplyPlanRequest): Promise<ApplyPlanResponse> {
    const res = await api.post<ApplyPlanResponse>("/api/ai/apply-plan", payload);
    return res.data;
  },

  /**
   * Evaluate project delivery risks across bottlenecks, slippage, and overload.
   */
  async analyzeRisks(projectId: string): Promise<RiskAnalysisResponse> {
    const res = await api.post<RiskAnalysisResponse>("/api/ai/risk-analysis", {
      project_id: projectId,
    });
    return res.data;
  },

  /**
   * Apply one-click automated risk remediation.
   */
  async applyRiskFix(payload: ApplyRiskFixRequest): Promise<ApplyRiskFixResponse> {
    const res = await api.post<ApplyRiskFixResponse>("/api/ai/risk-fix", payload);
    return res.data;
  },

  /**
   * Conversational query to the context-aware project assistant.
   */
  async askAssistant(payload: AssistantRequest): Promise<AssistantResponse> {
    const res = await api.post<AssistantResponse>("/api/ai/assistant", payload);
    return res.data;
  },

  /**
   * Parse raw meeting notes or transcripts into summary, decisions, and tasks.
   */
  async convertMeetingNotes(payload: { raw_text: string; project_id?: string }): Promise<MeetingNotesResponse> {
    const res = await api.post<MeetingNotesResponse>("/api/ai/meeting-notes-to-tasks", payload);
    return res.data;
  },
};

