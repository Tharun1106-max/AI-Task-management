/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The base URL pointing to the FastAPI backend API service.
   * Example: 'http://localhost:8000/api' or 'https://api.taskpilot.io/api'
   */
  readonly VITE_API_BASE_URL: string;

  /**
   * Application display brand title.
   * Example: 'TaskPilot'
   */
  readonly VITE_APP_NAME: string;

  /**
   * Feature flag enabling or disabling AI copilot, planner, and RAG capabilities.
   * Values: 'true' | 'false'
   */
  readonly VITE_ENABLE_AI_FEATURES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
