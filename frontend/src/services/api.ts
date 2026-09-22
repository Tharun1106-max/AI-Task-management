import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
// If the configured base URL ends with /api, strip it because service calls specify /api/* endpoints
const API_BASE_URL = rawBase.replace(/\/api\/?$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 90000,
});

// Request Interceptor: Attach Bearer JWT token if present
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("taskpilot_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle centralized error responses and 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string; code?: string; details?: any }; detail?: string }>) => {
    if (error.response?.status === 401) {
      // Clear token on authentication expiration
      localStorage.removeItem("taskpilot_token");
      localStorage.removeItem("taskpilot_refresh_token");

      // Only redirect if not already on the auth route to prevent redirect loops
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    return Promise.reject(error);
  }
);
