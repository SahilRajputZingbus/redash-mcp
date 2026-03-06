export interface RedashConfig {
  baseUrl: string;
  apiKey: string;
}

export interface DataSource {
  id: number;
  name: string;
  type: string;
  syntax: string;
}

export interface QuerySchedule {
  interval: number | null;   // seconds between runs; null = no schedule
  time: string | null;       // "HH:MM" UTC, used with interval >= 86400 (daily+)
  until: string | null;      // ISO date string, optional end date
  day_of_week: string | null; // e.g. "Sunday", used with interval = 604800 (weekly)
}

export interface Query {
  id: number;
  name: string;
  description: string;
  query: string;
  data_source_id: number;
  last_modified_by_id: number;
  is_archived: boolean;
  is_draft: boolean;
  updated_at: string;
  created_at: string;
  tags: string[];
  schedule: QuerySchedule | null;
}

export interface QueryResult {
  id: number;
  query_hash: string;
  query: string;
  data: {
    columns: Array<{ name: string; friendly_name: string; type: string }>;
    rows: Array<Record<string, unknown>>;
  };
  runtime: number;
  retrieved_at: string;
}

export interface Job {
  id: string;
  status: number; // 1=pending, 2=started, 3=done, 4=failed
  error: string;
  result: number; // query_result_id when done
  query_result_id: number;
}

export interface Dashboard {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_draft: boolean;
  tags: string[];
}

export interface Widget {
  id: number;
  text: string;
  visualization?: {
    query: Query;
    type: string;
    name: string;
  };
  options: Record<string, unknown>;
}

export interface DashboardDetail extends Dashboard {
  widgets: Widget[];
}

export interface SchemaTable {
  name: string;
  columns: string[];
}

export interface Visualization {
  id: number;
  type: string;
  name: string;
  description: string;
  options: Record<string, unknown>;
}

export class RedashClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: RedashConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Redash API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listDataSources(): Promise<DataSource[]> {
    return this.request<DataSource[]>('/api/data_sources');
  }

  async listQueries(params: { page?: number; page_size?: number; q?: string } = {}): Promise<{ count: number; page: number; page_size: number; results: Query[] }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    if (params.q) qs.set('q', params.q);
    return this.request(`/api/queries?${qs.toString()}`);
  }

  async getQuery(queryId: number): Promise<Query> {
    return this.request<Query>(`/api/queries/${queryId}`);
  }

  async createQuery(data: { name: string; query: string; data_source_id: number; description?: string }): Promise<Query> {
    return this.request<Query>('/api/queries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuery(queryId: number, data: Partial<{ name: string; query: string; data_source_id: number; description: string; schedule: QuerySchedule | null }>): Promise<Query> {
    return this.request<Query>(`/api/queries/${queryId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async setQuerySchedule(queryId: number, schedule: QuerySchedule | null): Promise<Query> {
    return this.updateQuery(queryId, { schedule });
  }

  async executeQuery(queryId: number, parameters: Record<string, unknown> = {}): Promise<{ job: Job } | { query_result: QueryResult }> {
    return this.request(`/api/queries/${queryId}/results`, {
      method: 'POST',
      body: JSON.stringify({ parameters, max_age: 0 }),
    });
  }

  async runAdHocQuery(dataSourceId: number, query: string, parameters: Record<string, unknown> = {}): Promise<{ job: Job } | { query_result: QueryResult }> {
    return this.request('/api/query_results', {
      method: 'POST',
      body: JSON.stringify({
        data_source_id: dataSourceId,
        query,
        parameters,
        max_age: 0,
      }),
    });
  }

  async getQueryResult(queryResultId: number): Promise<{ query_result: QueryResult }> {
    return this.request<{ query_result: QueryResult }>(`/api/query_results/${queryResultId}`);
  }

  async pollJob(jobId: string): Promise<{ job: Job }> {
    return this.request<{ job: Job }>(`/api/jobs/${jobId}`);
  }

  async waitForResult(jobId: string, maxWaitMs = 60000, pollIntervalMs = 1000): Promise<QueryResult> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const { job } = await this.pollJob(jobId);
      if (job.status === 3) {
        const result = await this.getQueryResult(job.query_result_id);
        return result.query_result;
      }
      if (job.status === 4) {
        throw new Error(`Query job failed: ${job.error}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Query timed out after ${maxWaitMs}ms`);
  }

  async listDashboards(params: { page?: number; page_size?: number; q?: string } = {}): Promise<{ count: number; results: Dashboard[] }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    if (params.q) qs.set('q', params.q);
    return this.request(`/api/dashboards?${qs.toString()}`);
  }

  async getDashboard(slugOrId: string): Promise<DashboardDetail> {
    return this.request<DashboardDetail>(`/api/dashboards/${slugOrId}`);
  }

  async createDashboard(name: string): Promise<DashboardDetail> {
    return this.request<DashboardDetail>('/api/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateDashboard(slugOrId: string, data: Partial<{ name: string; tags: string[]; is_draft: boolean }>): Promise<DashboardDetail> {
    return this.request<DashboardDetail>(`/api/dashboards/${slugOrId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVisualizationsForQuery(queryId: number): Promise<Visualization[]> {
    const query = await this.request<Query & { visualizations: Visualization[] }>(`/api/queries/${queryId}`);
    return query.visualizations ?? [];
  }

  async addWidget(dashboardId: number, options: {
    visualization_id?: number;
    text?: string;
    width?: number;
    options?: Record<string, unknown>;
  }): Promise<Widget> {
    return this.request<Widget>('/api/widgets', {
      method: 'POST',
      body: JSON.stringify({
        dashboard_id: dashboardId,
        visualization_id: options.visualization_id,
        text: options.text ?? '',
        width: options.width ?? 1,
        options: options.options ?? {},
      }),
    });
  }

  async getDataSourceSchema(dataSourceId: number, refresh = false): Promise<SchemaTable[]> {
    const qs = refresh ? '?refresh=true' : '';
    const result = await this.request<{ schema: SchemaTable[] }>(`/api/data_sources/${dataSourceId}/schema${qs}`);
    return result.schema ?? [];
  }

  async deleteWidget(widgetId: number): Promise<void> {
    await this.request(`/api/widgets/${widgetId}`, { method: 'DELETE' });
  }
}
