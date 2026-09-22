import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  authService,
  type User,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
} from "../services/authService";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UpdateProfilePayload) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("taskpilot_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount or token change
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem("taskpilot_token");
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await authService.getProfile();
        if (isMounted) {
          setUser(profile);
          setToken(storedToken);
        }
      } catch (error) {
        console.error("Failed to restore authenticated session:", error);
        localStorage.removeItem("taskpilot_token");
        localStorage.removeItem("taskpilot_refresh_token");
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await authService.login(data);
      localStorage.setItem("taskpilot_token", res.access_token);
      localStorage.setItem("taskpilot_refresh_token", res.refresh_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await authService.register(data);
      localStorage.setItem("taskpilot_token", res.access_token);
      localStorage.setItem("taskpilot_refresh_token", res.refresh_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem("taskpilot_token");
      localStorage.removeItem("taskpilot_refresh_token");
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (data: UpdateProfilePayload): Promise<User> => {
    const updated = await authService.updateProfile(data);
    setUser(updated);
    return updated;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
