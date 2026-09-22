import { api } from "./api";

export interface CalendarEvent {
  id: string;
  title: string;
  type: "TASK" | "PROJECT";
  date: string;
  priority?: string | null;
  status: string;
  project_id: string;
  project_name: string;
  is_overdue: boolean;
}

export interface CalendarEventsListResponse {
  events: CalendarEvent[];
  total: number;
}

export const calendarService = {
  /**
   * Retrieve unified project milestones and task deadlines.
   */
  async getCalendarEvents(params?: {
    project_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<CalendarEventsListResponse> {
    const response = await api.get<CalendarEventsListResponse>("/api/calendar/events", { params });
    return response.data;
  },
};
