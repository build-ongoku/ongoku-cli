import axios, { AxiosRequestConfig } from 'axios';
import { config, auth } from '../config/config';

// API Client for interacting with the Ongoku API
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.get('apiUrl');
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    additionalHeaders: Record<string, string> = {}
  ): Promise<T> {
    try {
      const token = await auth.getToken();
      
      // Allow authentication-related endpoints without a token
      if (!token && !endpoint.startsWith('/auth')) {
        throw new Error('Authentication required. Please run `ongoku login` first.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...additionalHeaders
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const axiosConfig: AxiosRequestConfig = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        ...(data ? { data } : {})
      };

      const response = await axios(axiosConfig);
      return response.data;
    } catch (error: any) {
      // Format error messages nicely
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 401) {
          throw new Error('Authentication failed. Please run `ongoku login` to re-authenticate.');
        }
        
        if (data.error) {
          throw new Error(`API Error (${status}): ${data.error}`);
        }
        
        throw new Error(`API Error: ${status} ${data}`);
      }
      
      if (error.request) {
        throw new Error(`Network Error: Could not connect to the Ongoku server at ${this.baseUrl}`);
      }
      
      throw error;
    }
  }

  /**
   * Get a list of all projects
   */
  async getProjects() {
    return this.request<any[]>('/projects');
  }

  /**
   * Get a specific project by ID
   */
  async getProject(id: string) {
    return this.request<any>(`/projects/${id}`);
  }

  /**
   * Generate a Git token for a specific project
   */
  async getGitToken(projectId: string) {
    return this.request<{
      success: boolean;
      git_info: {
        token: string;
        repo_url: string;
        auth_url: string;
        expires_at: number;
      }
    }>(`/projects/${projectId}/token`, 'POST');
  }

  /**
   * Push project schema updates
   * @param projectId The project ID to update
   * @param schema The schema object to push
   * @param skipGitCommit If true, tells the server not to commit to Git as the CLI will handle it
   */
  async pushProjectUpdates(projectId: string, schema: any, skipGitCommit: boolean = false) {
    return this.request<{
      success: boolean;
      project: any;
      warning?: string;
    }>(`/projects/${projectId}/push`, 'POST', { schema, skipGitCommit });
  }

  /**
   * Authenticate with the server
   * This methods doesn't require a token and will return a new token
   */
  async login(authCode: string) {
    return this.request<{
      userId: string;
      token: string;
      expiresAt: number;
    }>('/auth/code', 'POST', { authCode });
  }

  /**
   * Validate the current auth token
   */
  async validateToken() {
    return this.request<{
      valid: boolean;
      userId: string;
    }>('/auth/validate');
  }
  
  /**
   * Check API health (doesn't require authentication)
   */
  async checkHealth() {
    try {
      // Use the health endpoint within the CLI API namespace
      const healthUrl = `${this.baseUrl}/health`;
      console.log(`Checking health at: ${healthUrl}`);
      const response = await axios.get(healthUrl);
      return response.data;
    } catch (error: any) {
      console.error(`Health check failed: ${error.message}`);
      throw new Error(`Could not connect to the Ongoku server. Please ensure the server is running.`);
    }
  }
}
