import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, connectDatabase, getAlarms, getComplaints, getLinks, getMonthlyPerformance, getSites } from "./database.js";

const port = Number(process.env.WEB_PORT ?? 3000);
const host = process.env.WEB_HOST?.trim() || "127.0.0.1";
const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

const assets: Record<string, { file: string; contentType: string }> = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" }
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Only GET requests are supported." });
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok", dataSource: process.env.MONGODB_URI?.trim() ? "MongoDB" : "built-in sample data" });
    return;
  }

  if (url.pathname === "/api/data") {
    try {
      const [sites, links, alarms, complaints, monthlyPerformance] = await Promise.all([
        getSites(),
        getLinks(),
        getAlarms(),
        getComplaints(),
        getMonthlyPerformance()
      ]);
      sendJson(response, 200, {
        dataSource: process.env.MONGODB_URI?.trim() ? "MongoDB" : "built-in sample data",
        sites,
        links,
        alarms,
        complaints,
        monthlyPerformance
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      sendJson(response, 500, { error: "Could not load network data. Check the server logs and database connection." });
    }
    return;
  }

  const asset = assets[url.pathname];
  if (!asset) {
    sendJson(response, 404, { error: "Page not found." });
    return;
  }

  try {
    const body = await readFile(resolve(publicDirectory, asset.file));
    response.writeHead(200, {
      "Content-Type": asset.contentType,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:"
    });
    response.end(body);
  } catch (error) {
    console.error(`Failed to serve ${asset.file}:`, error);
    sendJson(response, 500, { error: "The dashboard file could not be served." });
  }
}

async function main(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("WEB_PORT must be a valid TCP port.");
  await connectDatabase();

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  server.on("error", error => {
    console.error("Dashboard server error:", error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.error(`Telecom Network dashboard: http://${host}:${port}`);
  });

  const shutdown = () => {
    server.close(async error => {
      if (error) console.error("Error closing dashboard server:", error);
      await closeDatabase();
      process.exit(error ? 1 : 0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch(async error => {
  console.error("Failed to start Telecom Network dashboard:", error);
  await closeDatabase();
  process.exitCode = 1;
});
