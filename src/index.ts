import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { RedashClient } from './redash-client.js';

const REDASH_BASE_URL = process.env.REDASH_BASE_URL ?? '';
const REDASH_API_KEY = process.env.REDASH_API_KEY ?? '';

if (!REDASH_BASE_URL || !REDASH_API_KEY) {
  process.stderr.write('Error: REDASH_BASE_URL and REDASH_API_KEY environment variables are required\n');
  process.exit(1);
}

const client = new RedashClient({ baseUrl: REDASH_BASE_URL, apiKey: REDASH_API_KEY });

const tools: Tool[] = [
  {
    name: 'list_data_sources',
    description: 'List all available data sources in Redash',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_queries',
    description: 'List saved queries in Redash with optional search and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search term to filter queries by name',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        page_size: {
          type: 'number',
          description: 'Number of results per page (default: 25)',
        },
      },
    },
  },
  {
    name: 'get_query',
    description: 'Get details of a specific saved query by ID, including its SQL',
    inputSchema: {
      type: 'object',
      properties: {
        query_id: {
          type: 'number',
          description: 'The numeric ID of the query',
        },
      },
      required: ['query_id'],
    },
  },
  {
    name: 'execute_saved_query',
    description: 'Execute a saved Redash query by ID and return its results. Waits for completion.',
    inputSchema: {
      type: 'object',
      properties: {
        query_id: {
          type: 'number',
          description: 'The numeric ID of the saved query to execute',
        },
        parameters: {
          type: 'object',
          description: 'Optional query parameters as key-value pairs (for parameterized queries)',
          additionalProperties: true,
        },
        max_wait_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait for results (default: 60)',
        },
      },
      required: ['query_id'],
    },
  },
  {
    name: 'run_query',
    description: 'Run an ad-hoc SQL query against a data source and return results. Waits for completion.',
    inputSchema: {
      type: 'object',
      properties: {
        data_source_id: {
          type: 'number',
          description: 'The ID of the data source to run the query against',
        },
        query: {
          type: 'string',
          description: 'The SQL query to execute',
        },
        parameters: {
          type: 'object',
          description: 'Optional query parameters',
          additionalProperties: true,
        },
        max_wait_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait for results (default: 60)',
        },
      },
      required: ['data_source_id', 'query'],
    },
  },
  {
    name: 'create_query',
    description: 'Create and save a new query in Redash',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the query',
        },
        query: {
          type: 'string',
          description: 'The SQL query text',
        },
        data_source_id: {
          type: 'number',
          description: 'The ID of the data source this query will run against',
        },
        description: {
          type: 'string',
          description: 'Optional description for the query',
        },
      },
      required: ['name', 'query', 'data_source_id'],
    },
  },
  {
    name: 'list_dashboards',
    description: 'List dashboards in Redash with optional search and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search term to filter dashboards by name',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        page_size: {
          type: 'number',
          description: 'Number of results per page (default: 25)',
        },
      },
    },
  },
  {
    name: 'get_dashboard',
    description: 'Get details of a specific dashboard including its widgets and queries',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The slug or ID of the dashboard (visible in the dashboard URL)',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'create_dashboard',
    description: 'Create a new empty dashboard in Redash',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new dashboard',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the dashboard',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_widget_to_dashboard',
    description: 'Add a query visualization as a widget to a dashboard. Use get_query_visualizations to find visualization IDs first.',
    inputSchema: {
      type: 'object',
      properties: {
        dashboard_id: {
          type: 'number',
          description: 'The numeric ID of the dashboard (from create_dashboard or get_dashboard)',
        },
        visualization_id: {
          type: 'number',
          description: 'The ID of the visualization to add (from get_query_visualizations)',
        },
        text: {
          type: 'string',
          description: 'Text content for a text-only widget (use instead of visualization_id)',
        },
        width: {
          type: 'number',
          description: 'Widget width: 1 (half) or 2 (full). Default: 1',
        },
      },
      required: ['dashboard_id'],
    },
  },
  {
    name: 'get_query_visualizations',
    description: 'List all visualizations available for a query (charts, tables, etc.) with their IDs',
    inputSchema: {
      type: 'object',
      properties: {
        query_id: {
          type: 'number',
          description: 'The numeric ID of the query',
        },
      },
      required: ['query_id'],
    },
  },
  {
    name: 'get_schema',
    description: 'List all tables (and their columns) for a data source. Use search to filter by table name.',
    inputSchema: {
      type: 'object',
      properties: {
        data_source_id: { type: 'number', description: 'The ID of the data source (from list_data_sources)' },
        search: { type: 'string', description: 'Filter tables by name (case-insensitive substring match)' },
        refresh: { type: 'boolean', description: 'Force refresh the schema cache (default: false)' },
      },
      required: ['data_source_id'],
    },
  },
  {
    name: 'get_table_schema',
    description: 'Get the columns for a specific table in a data source',
    inputSchema: {
      type: 'object',
      properties: {
        data_source_id: { type: 'number', description: 'The ID of the data source' },
        table_name: { type: 'string', description: 'Exact name of the table' },
        refresh: { type: 'boolean', description: 'Force refresh the schema cache (default: false)' },
      },
      required: ['data_source_id', 'table_name'],
    },
  },
  {
    name: 'get_query_schedule',
    description: 'Get the current auto-refresh schedule for a saved query',
    inputSchema: {
      type: 'object',
      properties: {
        query_id: { type: 'number', description: 'The numeric ID of the query' },
      },
      required: ['query_id'],
    },
  },
  {
    name: 'set_query_schedule',
    description: 'Set or update the auto-refresh schedule for a saved query. Use interval=0 or call with no schedule fields to clear the schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        query_id: { type: 'number', description: 'The numeric ID of the query' },
        interval_seconds: {
          type: 'number',
          description: 'How often to run (in seconds). Common values: 300 (5min), 1800 (30min), 3600 (1h), 86400 (daily), 604800 (weekly). Use 0 to clear the schedule.',
        },
        time: {
          type: 'string',
          description: 'Time of day to run in "HH:MM" UTC format. Only relevant for daily (86400) or weekly (604800) intervals.',
        },
        day_of_week: {
          type: 'string',
          description: 'Day of week to run (e.g. "Monday"). Only relevant for weekly (604800) interval.',
        },
        until: {
          type: 'string',
          description: 'Optional end date in ISO format (e.g. "2026-12-31"). Schedule stops after this date.',
        },
      },
      required: ['query_id', 'interval_seconds'],
    },
  },
  {
    name: 'delete_widget',
    description: 'Remove a widget from a dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        widget_id: {
          type: 'number',
          description: 'The numeric ID of the widget to delete',
        },
      },
      required: ['widget_id'],
    },
  },
];

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}min`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  if (seconds < 604800) return `${seconds / 86400}d`;
  return `${seconds / 604800}w`;
}

function formatQueryResult(result: Awaited<ReturnType<RedashClient['waitForResult']>>) {
  const { columns, rows } = result.data;
  const colNames = columns.map(c => c.friendly_name || c.name);

  if (rows.length === 0) {
    return `Query returned 0 rows.\nColumns: ${colNames.join(', ')}`;
  }

  // Format as a markdown table
  const header = `| ${colNames.join(' | ')} |`;
  const separator = `| ${colNames.map(() => '---').join(' | ')} |`;
  const rowLines = rows.slice(0, 200).map(row => {
    const cells = columns.map(c => {
      const val = row[c.name];
      return val === null || val === undefined ? '' : String(val);
    });
    return `| ${cells.join(' | ')} |`;
  });

  let output = [header, separator, ...rowLines].join('\n');
  if (rows.length > 200) {
    output += `\n\n(Showing 200 of ${rows.length} rows. Runtime: ${result.runtime.toFixed(2)}s)`;
  } else {
    output += `\n\n(${rows.length} rows, runtime: ${result.runtime.toFixed(2)}s)`;
  }
  return output;
}

const server = new Server(
  { name: 'redash-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_data_sources': {
        const sources = await client.listDataSources();
        const text = sources
          .map(s => `ID: ${s.id} | Name: ${s.name} | Type: ${s.type}`)
          .join('\n');
        return { content: [{ type: 'text', text: text || 'No data sources found.' }] };
      }

      case 'list_queries': {
        const { search, page, page_size } = args as { search?: string; page?: number; page_size?: number };
        const result = await client.listQueries({ q: search, page, page_size });
        const lines = result.results.map(q =>
          `ID: ${q.id} | ${q.name}${q.description ? ` — ${q.description}` : ''}${q.tags?.length ? ` [${q.tags.join(', ')}]` : ''}`
        );
        const text = `Found ${result.count} queries (page ${result.page}, ${result.page_size} per page):\n\n${lines.join('\n')}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'get_query': {
        const { query_id } = args as { query_id: number };
        const q = await client.getQuery(query_id);
        const text = [
          `**${q.name}** (ID: ${q.id})`,
          q.description ? `Description: ${q.description}` : null,
          `Data Source ID: ${q.data_source_id}`,
          `Tags: ${q.tags?.join(', ') || 'none'}`,
          `Draft: ${q.is_draft} | Archived: ${q.is_archived}`,
          `Updated: ${q.updated_at}`,
          '',
          '```sql',
          q.query,
          '```',
        ].filter(l => l !== null).join('\n');
        return { content: [{ type: 'text', text }] };
      }

      case 'execute_saved_query': {
        const { query_id, parameters = {}, max_wait_seconds = 60 } = args as {
          query_id: number;
          parameters?: Record<string, unknown>;
          max_wait_seconds?: number;
        };
        const response = await client.executeQuery(query_id, parameters);
        let queryResult;
        if ('query_result' in response) {
          queryResult = response.query_result;
        } else {
          queryResult = await client.waitForResult(response.job.id, max_wait_seconds * 1000);
        }
        return { content: [{ type: 'text', text: formatQueryResult(queryResult) }] };
      }

      case 'run_query': {
        const { data_source_id, query, parameters = {}, max_wait_seconds = 60 } = args as {
          data_source_id: number;
          query: string;
          parameters?: Record<string, unknown>;
          max_wait_seconds?: number;
        };
        const response = await client.runAdHocQuery(data_source_id, query, parameters);
        let queryResult;
        if ('query_result' in response) {
          queryResult = response.query_result;
        } else {
          queryResult = await client.waitForResult(response.job.id, max_wait_seconds * 1000);
        }
        return { content: [{ type: 'text', text: formatQueryResult(queryResult) }] };
      }

      case 'create_query': {
        const { name, query, data_source_id, description } = args as {
          name: string;
          query: string;
          data_source_id: number;
          description?: string;
        };
        const created = await client.createQuery({ name, query, data_source_id, description });
        const text = `Query created successfully!\nID: ${created.id}\nName: ${created.name}\nURL: ${REDASH_BASE_URL}/queries/${created.id}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'list_dashboards': {
        const { search, page, page_size } = args as { search?: string; page?: number; page_size?: number };
        const result = await client.listDashboards({ q: search, page, page_size });
        const lines = result.results.map(d =>
          `Slug: ${d.slug} | ${d.name}${d.tags?.length ? ` [${d.tags.join(', ')}]` : ''}`
        );
        const text = `Found ${result.count} dashboards:\n\n${lines.join('\n')}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'get_dashboard': {
        const { slug } = args as { slug: string };
        const dash = await client.getDashboard(slug);
        const widgetLines = (dash.widgets || [])
          .filter(w => w.visualization?.query)
          .map(w => `  - Query: "${w.visualization!.query.name}" (ID: ${w.visualization!.query.id}), Viz: ${w.visualization!.type}`);
        const text = [
          `**${dash.name}** (slug: ${dash.slug})`,
          `Tags: ${dash.tags?.join(', ') || 'none'}`,
          `Draft: ${dash.is_draft} | Archived: ${dash.is_archived}`,
          `Updated: ${dash.updated_at}`,
          '',
          widgetLines.length ? `Widgets (${widgetLines.length}):\n${widgetLines.join('\n')}` : 'No query widgets.',
        ].join('\n');
        return { content: [{ type: 'text', text }] };
      }

      case 'get_schema': {
        const { data_source_id, search, refresh } = args as { data_source_id: number; search?: string; refresh?: boolean };
        const tables = await client.getDataSourceSchema(data_source_id, refresh);
        const filtered = search
          ? tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
          : tables;
        if (!filtered.length) {
          return { content: [{ type: 'text', text: search ? `No tables matching "${search}".` : 'No schema available.' }] };
        }
        const lines = filtered.map(t => `${t.name} (${t.columns.length} cols): ${t.columns.join(', ')}`);
        const text = `${filtered.length} table(s)${search ? ` matching "${search}"` : ''}:\n\n${lines.join('\n')}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'get_table_schema': {
        const { data_source_id, table_name, refresh } = args as { data_source_id: number; table_name: string; refresh?: boolean };
        const tables = await client.getDataSourceSchema(data_source_id, refresh);
        const table = tables.find(t => t.name.toLowerCase() === table_name.toLowerCase());
        if (!table) {
          return { content: [{ type: 'text', text: `Table "${table_name}" not found. Use get_schema to browse available tables.` }] };
        }
        const text = `**${table.name}** — ${table.columns.length} columns:\n\n${table.columns.map(c => `- ${c}`).join('\n')}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'get_query_schedule': {
        const { query_id } = args as { query_id: number };
        const q = await client.getQuery(query_id);
        if (!q.schedule || q.schedule.interval === null) {
          return { content: [{ type: 'text', text: `Query "${q.name}" (ID: ${q.id}) has no refresh schedule.` }] };
        }
        const s = q.schedule;
        const lines = [
          `Query: "${q.name}" (ID: ${q.id})`,
          `Interval: ${s.interval}s (${formatInterval(s.interval!)})`,
          s.time ? `Time (UTC): ${s.time}` : null,
          s.day_of_week ? `Day of week: ${s.day_of_week}` : null,
          s.until ? `Until: ${s.until}` : null,
        ].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text: lines }] };
      }

      case 'set_query_schedule': {
        const { query_id, interval_seconds, time, day_of_week, until } = args as {
          query_id: number;
          interval_seconds: number;
          time?: string;
          day_of_week?: string;
          until?: string;
        };
        const schedule = interval_seconds === 0
          ? null
          : { interval: interval_seconds, time: time ?? null, day_of_week: day_of_week ?? null, until: until ?? null };
        const q = await client.setQuerySchedule(query_id, schedule);
        const text = schedule === null
          ? `Schedule cleared for query "${q.name}" (ID: ${q.id}).`
          : `Schedule updated for query "${q.name}" (ID: ${q.id}).\nInterval: ${formatInterval(interval_seconds)}${time ? `\nTime (UTC): ${time}` : ''}${day_of_week ? `\nDay: ${day_of_week}` : ''}${until ? `\nUntil: ${until}` : ''}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'create_dashboard': {
        const { name, tags } = args as { name: string; tags?: string[] };
        const dash = await client.createDashboard(name);
        if (tags?.length) {
          await client.updateDashboard(String(dash.id), { tags });
        }
        const text = `Dashboard created!\nID: ${dash.id}\nSlug: ${dash.slug}\nURL: ${REDASH_BASE_URL}/dashboard/${dash.slug}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'get_query_visualizations': {
        const { query_id } = args as { query_id: number };
        const vizs = await client.getVisualizationsForQuery(query_id);
        if (!vizs.length) {
          return { content: [{ type: 'text', text: 'No visualizations found for this query.' }] };
        }
        const lines = vizs.map(v => `ID: ${v.id} | Type: ${v.type} | Name: ${v.name}${v.description ? ` — ${v.description}` : ''}`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      case 'add_widget_to_dashboard': {
        const { dashboard_id, visualization_id, text: widgetText, width } = args as {
          dashboard_id: number;
          visualization_id?: number;
          text?: string;
          width?: number;
        };
        const widget = await client.addWidget(dashboard_id, { visualization_id, text: widgetText, width });
        const text = `Widget added successfully!\nWidget ID: ${widget.id}\nUse delete_widget with ID ${widget.id} to remove it.`;
        return { content: [{ type: 'text', text }] };
      }

      case 'delete_widget': {
        const { widget_id } = args as { widget_id: number };
        await client.deleteWidget(widget_id);
        return { content: [{ type: 'text', text: `Widget ${widget_id} deleted successfully.` }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('Redash MCP server running\n');
