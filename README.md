# Telecom Network MCP – beginner starter

A read-only MCP server built with Node.js, TypeScript, the official MCP TypeScript SDK v2, and optional MongoDB connectivity.

## What is included

Tools:
- `get_network_summary`
- `list_network_sites`
- `get_microwave_link`
- `analyze_microwave_capacity`
- `search_network_alarms`
- `get_capacity_by_region`
- `search_network_complaints`
- `compare_network_performance`
- `get_sites_geojson`
- `generate_network_report`

The project starts with fictional Nepal-flavoured sample data. If `MONGODB_URI` is configured, it reads from MongoDB collections instead. Monthly performance and complaints are demonstration datasets, not live OSS/NMS feeds.

The server also provides the `telecom://network/summary` MCP resource and the `network-engineering-report` prompt.

## 1. Requirements

- Node.js 22 LTS or a currently supported Node.js release
- npm
- Visual Studio Code (recommended)
- Claude Desktop for the local stdio test
- MongoDB is optional for the first test

Check installation:

```bash
node --version
npm --version
```

## 2. Install and run

Open a terminal in this project folder:

```bash
npm install
npm run dev
```

The server uses stdio. It may look like the terminal is waiting; that is normal because an MCP client starts it and communicates through stdin/stdout. Do not type normal commands into that running terminal.

Build JavaScript output:

```bash
npm run build
npm start
```

### Open the standalone dashboard

Start the local web dashboard in a separate terminal:

```bash
npm run web
```

Then open `http://127.0.0.1:3000`. The dashboard includes site and microwave filters, capacity screening and regional totals, alarm/complaint investigation, monthly performance comparison, a local coordinate plot, GeoJSON download and Markdown engineering reports. It reads through the same MongoDB/sample-data layer as the MCP server and is read-only.

To run the compiled dashboard instead:

```bash
npm run build
npm run web:start
```

By default, the dashboard binds to `127.0.0.1` and port `3000`. `WEB_HOST` and `WEB_PORT` can be set for local development. Do not bind it to a public interface or expose it on a VPS without adding authentication, authorization, HTTPS and appropriate network controls.

## 3. Test using MCP Inspector

In a second terminal, from the project folder, run:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

The Inspector opens a local web interface and launches your built stdio server. Select the server connection, list the available tools, and call `get_network_summary`, `list_network_sites`, or `analyze_microwave_capacity`.

## 4. Connect to Claude Desktop (Windows)

1. Build the project with `npm run build`.
2. Find the full path to `node.exe` by running `where node` in Command Prompt.
3. Open Claude Desktop's local MCP configuration file. A common Windows location is:

   `%APPDATA%\\Claude\\claude_desktop_config.json`

4. Add the server entry below, replacing both paths with your actual paths. Use double backslashes in JSON paths.

```json
{
  "mcpServers": {
    "telecom-network": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\YOUR\\PATH\\telecom-network-mcp\\dist\\index.js"
      ]
    }
  }
}
```

5. Save the file and fully restart Claude Desktop.
6. In Claude, open the connectors/tools area and confirm that the five Telecom Network tools appear.

If your existing config already has other servers, add only the `telecom-network` entry inside its existing `mcpServers` object; do not overwrite the other entries.

## 5. Connect MongoDB

Create a MongoDB database named `telecom_network` and these collections:
- `sites`
- `microwaveLinks`
- `alarms`
- `complaints`
- `monthlyPerformance`

Copy `.env.example` to `.env` and set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=telecom_network
```

For MongoDB Atlas, use the connection string from Atlas, keep credentials out of source control, and restrict network access. Restart the MCP server after changing `.env`.

The collection field names should match the sample JSON files. You can import JSON records using MongoDB Compass:
- Open the collection
- Select Add Data > Import JSON or CSV
- Import the matching file from `data/`
- Import `complaints.json` into `complaints` and `monthlyPerformance.json` into `monthlyPerformance` to use the added sample tools.

## 6. Sample questions for Claude

- Give me a network summary.
- List all 4G sites in Bagmati.
- Show microwave links in degraded state.
- Which links have utilization above 80 percent?
- Show open major alarms.
- Find alarms associated with link MW-1002.
- Show microwave links in Kathmandu district below 99% availability.
- Find links with configured capacity below 500 Mbps.
- Show configured microwave capacity by region.
- Compare network performance for 2026-09 and 2026-10.
- Find sites with multiple open complaints.
- Generate an engineering report for Bagmati.
- Return site locations as GeoJSON for mapping.

## 7. Important design limitations

This is a starter and demonstration, not a production NMS or radio-planning engine.

- Sample values are fictional and must not be treated as live network measurements.
- Capacity flagging is a screening calculation, not a link engineering approval.
- Monthly performance averages are unweighted across regional records. Cross-region link capacity is split equally across its listed regions for regional summaries.
- The report tool returns Markdown text; Excel/PDF export, historical live performance feeds, fiber inventory and OSS/NMS API integration are not included yet.
- The first version is read-only.
- The first version uses local stdio transport. This works well for Claude Desktop and other clients that can launch a local MCP process.
- The standalone browser dashboard is a local read-only interface, not the secured remote VPS service described in the architecture.
- For a centrally hosted server on a VPS, add Streamable HTTP transport, HTTPS, OAuth or another strong authentication method, per-user authorization, rate limits, audit logging, and monitoring before exposing it to remote clients.

## 8. Suggested next development phases

1. Import your real microwave Excel workbook and map its column names.
2. Add link distance, frequency, polarization, channel bandwidth, modulation, RSL, fade margin and path profile fields.
3. Add traffic time-series and busy-hour analysis.
4. Add a full GIS basemap and GIS output formats beyond the current local coordinate plot and GeoJSON export.
5. Add Streamable HTTP for remote access from Claude and other MCP clients.
6. Add role-based access and tenant separation before commercial use.

## Troubleshooting

- **Claude does not show the tools:** verify JSON syntax, absolute paths, Node.js path, build output, then fully restart Claude Desktop.
- **Server exits immediately:** run `node dist/index.js` in a terminal to inspect errors; MCP stdio servers expect an MCP client to speak on stdin/stdout.
- **MongoDB connection error:** temporarily clear `MONGODB_URI` to verify the sample-data mode, then check MongoDB service, URI and database network permissions.
- **Do not use `console.log()` in stdio server code:** stdout is reserved for MCP protocol messages. Use `console.error()` for diagnostics.
