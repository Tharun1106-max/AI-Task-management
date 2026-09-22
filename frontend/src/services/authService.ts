import { api } from "./api";

export type UserRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  avatar_url?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export const authService = {
  /**
   * Register a new user account and obtain access tokens.
   */
  async register(data: RegisterPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/api/auth/register", data);
    return response.data;
  },

  /**
   * Authenticate with email and password credentials.
   */
  async login(data: LoginPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/api/auth/login", data);
    return response.data;
  },

  /**
   * Perform stateless server logout notification.
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post<{ success: boolean; message: string }>("/api/auth/logout");
      return response.data;
    } catch {
      return { success: true, message: "Logged out locally." };
    }
  },

  /**
   * Retrieve currently authenticated user profile.
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>("/api/users/me");
    return response.data;
  },

  /**
   * Update full name and avatar URL.
   */
  async updateProfile(data: UpdateProfilePayload): Promise<User> {
    const response = await api.put<User>("/api/users/me", data);
    return response.data;
  },

  /**
   * Change account password with existing password confirmation.
   */
  async updatePassword(data: ChangePasswordPayload): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>("/api/users/password", data);
    return response.data;
  },
};
