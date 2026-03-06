# Redash MCP Server

An MCP server that connects Claude to your Redash instance, allowing you to list data sources, run queries, browse dashboards, and more.

## Setup

### 1. Get your Redash API Key

Log into Redash → Profile (top right) → **API Key**. Copy it.

### 2. Build the server

```bash
npm install
npm run build
```

### 3. Get the absolute path to this repo

```bash
pwd
# e.g. /home/youruser/redash-mcp
```

### 4. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "redash": {
      "command": "node",
      "args": ["/absolute/path/to/redash-mcp/dist/index.js"],
      "env": {
        "REDASH_BASE_URL": "https://your-redash-instance.com",
        "REDASH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Replace `/absolute/path/to/redash-mcp` with the output of `pwd` from step 3.

### 5. Configure Claude Code

Run from inside the repo directory:

```bash
claude mcp add redash -- node "$(pwd)/dist/index.js"
```

Then set the env vars in `~/.claude/mcp_config.json`:

```json
{
  "mcpServers": {
    "redash": {
      "command": "node",
      "args": ["/absolute/path/to/redash-mcp/dist/index.js"],
      "env": {
        "REDASH_BASE_URL": "https://your-redash-instance.com",
        "REDASH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop / Claude Code after updating the config.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_data_sources` | List all data sources (get IDs for `run_query`) |
| `list_queries` | List saved queries with optional search |
| `get_query` | Get a query's SQL and metadata by ID |
| `execute_saved_query` | Run a saved query by ID, returns results |
| `run_query` | Run ad-hoc SQL against any data source |
| `create_query` | Save a new query to Redash |
| `list_dashboards` | List all dashboards |
| `get_dashboard` | Get dashboard details and widget list |

## Example Usage in Claude

> "Show me all available data sources"

> "Search for queries related to 'revenue'"

> "Run query ID 42 and show me the results"

> "Run this SQL against data source 1: `SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()`"

> "List all dashboards and get details for the 'operations' dashboard"
