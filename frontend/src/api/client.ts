import axios, { AxiosInstance, AxiosError } from 'axios';
import { Task, Workflow, LogEntry, OrchestratorStatus, CreateWorkflowRequest } from '../types';

// API base URL - configure via environment variable
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class PhoenixAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============ Workflow Endpoints ============
  
  async createWorkflow(request: CreateWorkflowRequest): Promise<Workflow> {
    const { data } = await this.client.post<Workflow>('/workflows', request);
    return data;
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    const { data } = await this.client.get<Workflow>(`/workflows/${workflowId}`);
    return data;
  }

  async listWorkflows(): Promise<Workflow[]> {
    const { data } = await this.client.get<Workflow[]>('/workflows');
    return data;
  }

  // ============ Task Endpoints ============

  async getTasks(workflowId: string): Promise<Task[]> {
    const { data } = await this.client.get<Task[]>(`/workflows/${workflowId}/tasks`);
    return data;
  }

  async getTask(taskId: string): Promise<Task> {
    const { data } = await this.client.get<Task>(`/tasks/${taskId}`);
    return data;
  }

  // ============ Log Endpoints ============

  async getLogs(workflowId: string, limit: number = 100): Promise<LogEntry[]> {
    const { data } = await this.client.get<LogEntry[]>(
      `/workflows/${workflowId}/logs`,
      { params: { limit } }
    );
    return data;
  }

  // ============ Admin Endpoints ============

  async killOrchestrator(): Promise<void> {
    await this.client.post('/admin/kill');
  }

  async getOrchestratorStatus(): Promise<OrchestratorStatus> {
    const { data } = await this.client.get<OrchestratorStatus>('/admin/status');
    return data;
  }
}

// Export singleton instance
export const api = new PhoenixAPI();
export default api;