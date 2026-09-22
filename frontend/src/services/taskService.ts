import { api } from "./api";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "BLOCKED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskComment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string | null;
  content: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  uploaded_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  project_id: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  dependencies: string[];
  tags: string[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  project_id: string;
  assignee_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  dependencies?: string[];
  tags?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  assignee_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  dependencies?: string[];
  tags?: string[];
}

export const taskService = {
  /**
   * List tasks filtered by criteria.
   */
  async getTasks(params?: {
    project_id?: string;
    assignee_id?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    search?: string;
  }): Promise<TaskListResponse> {
    const response = await api.get<TaskListResponse>("/api/tasks", { params });
    return response.data;
  },

  /**
   * Get single task with comments and attachments.
   */
  async getTaskById(id: string): Promise<Task> {
    const response = await api.get<Task>(`/api/tasks/${id}`);
    return response.data;
  },

  /**
   * Create a new task.
   */
  async createTask(data: CreateTaskPayload): Promise<Task> {
    const response = await api.post<Task>("/api/tasks", data);
    return response.data;
  },

  /**
   * Update task fields (e.g. status, priority, title, dependencies).
   */
  async updateTask(id: string, data: UpdateTaskPayload): Promise<Task> {
    const response = await api.put<Task>(`/api/tasks/${id}`, data);
    return response.data;
  },

  /**
   * Delete task and automatically clean up dependency arrays.
   */
  async deleteTask(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/tasks/${id}`);
    return response.data;
  },

  /**
   * Add a discussion comment to a task.
   */
  async addComment(taskId: string, content: string): Promise<Task> {
    const response = await api.post<Task>(`/api/tasks/${taskId}/comments`, { content });
    return response.data;
  },
};
