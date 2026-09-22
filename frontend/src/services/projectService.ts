import { api } from "./api";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  member_ids: string[];
  start_date?: string | null;
  deadline?: string | null;
  status: ProjectStatus;
  progress: number;
  tags: string[];
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  member_ids?: string[];
  start_date?: string;
  deadline?: string;
  status?: ProjectStatus;
  tags?: string[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  member_ids?: string[];
  start_date?: string;
  deadline?: string;
  status?: ProjectStatus;
  tags?: string[];
}

export const projectService = {
  /**
   * Fetch all projects accessible to current user.
   */
  async getProjects(params?: {
    status?: ProjectStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ProjectListResponse> {
    const response = await api.get<ProjectListResponse>("/api/projects", { params });
    return response.data;
  },

  /**
   * Retrieve single project details by ID with calculated progress metrics.
   */
  async getProjectById(id: string): Promise<Project> {
    const response = await api.get<Project>(`/api/projects/${id}`);
    return response.data;
  },

  /**
   * Create a new project.
   */
  async createProject(data: CreateProjectPayload): Promise<Project> {
    const response = await api.post<Project>("/api/projects", data);
    return response.data;
  },

  /**
   * Update an existing project (owner/admin only).
   */
  async updateProject(id: string, data: UpdateProjectPayload): Promise<Project> {
    const response = await api.put<Project>(`/api/projects/${id}`, data);
    return response.data;
  },

  /**
   * Delete project and cascade associated tasks.
   */
  async deleteProject(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/projects/${id}`);
    return response.data;
  },
};
