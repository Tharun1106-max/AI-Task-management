import { api } from "./api";
import type { UserRole } from "./authService";

export interface ProjectMember {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string | null;
  assigned_tasks_count: number;
  completed_tasks_count: number;
  is_owner: boolean;
}

export interface ProjectMemberListResponse {
  project_id: string;
  members: ProjectMember[];
  total: number;
}

export interface InviteMemberPayload {
  email: string;
  role?: UserRole;
}

export const teamService = {
  /**
   * Fetch team members and their task loads for a given project.
   */
  async getProjectMembers(projectId: string): Promise<ProjectMemberListResponse> {
    const response = await api.get<ProjectMemberListResponse>(`/api/projects/${projectId}/members`);
    return response.data;
  },

  /**
   * Invite an existing user to join a project team with a designated role.
   */
  async inviteMember(projectId: string, payload: InviteMemberPayload): Promise<ProjectMember> {
    const response = await api.post<ProjectMember>(`/api/projects/${projectId}/members`, payload);
    return response.data;
  },

  /**
   * Update a member's role in the project.
   */
  async updateMemberRole(projectId: string, userId: string, role: UserRole): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>(`/api/projects/${projectId}/members/${userId}`, { role });
    return response.data;
  },

  /**
   * Remove a member from the project and unassign their active tasks.
   */
  async removeMember(projectId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/projects/${projectId}/members/${userId}`);
    return response.data;
  },
};
