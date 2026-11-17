import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { closeDatabase, connectDatabase, getAlarms, getComplaints, getLinks, getMonthlyPerformance, getSites } from "./database.js";

const server = new McpServer({
  name: "telecom-network-mcp",
  version: "1.0.0"
});

const output = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
});

async function getNetworkSummary() {
  const [sites, links, alarms] = await Promise.all([getSites(), getLinks(), getAlarms()]);
  return {
    sites: {
      total: sites.length,
      active: sites.filter(s => s.status === "active").length,
      inactive: sites.filter(s => s.status === "inactive").length,
      maintenance: sites.filter(s => s.status === "maintenance").length
    },
    microwaveLinks: {
      total: links.length,
      up: links.filter(l => l.status === "up").length,
      down: links.filter(l => l.status === "down").length,
      degraded: links.filter(l => l.status === "degraded").length,
      totalConfiguredCapacityMbps: links.reduce((n, l) => n + l.capacityMbps, 0)
    },
    alarms: {
      open: alarms.filter(a => a.status === "open").length,
      critical: alarms.filter(a => a.severity === "critical" && a.status === "open").length,
      major: alarms.filter(a => a.severity === "major" && a.status === "open").length
    },
    dataSource: process.env.MONGODB_URI?.trim() ? "MongoDB" : "built-in sample data"
  };
}

server.registerResource(
  "network-summary",
  "telecom://network/summary",
  {
    title: "Telecom network summary",
    description: "Current read-only network counts and configured microwave capacity.",
    mimeType: "application/json"
  },
  async uri => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await getNetworkSummary(), null, 2) }]
  })
);

server.registerPrompt(
  "network-engineering-report",
  {
    title: "Prepare a network engineering report",
    description: "Use the network report tool to summarize sample or configured network data.",
    argsSchema: z.object({ region: z.string().optional() })
  },
  ({ region }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Prepare a concise engineering report using the generate_network_report tool${region ? ` for ${region}` : " for all regions"}. Clearly identify the data source and label built-in sample data as fictional.`
      }
    }]
  })
);

server.registerTool(
  "list_network_sites",
  {
    title: "List network sites",
    description: "List telecom sites. Optional filters: region, district, technology and operational status. Returns up to 100 sites.",
    inputSchema: z.object({
      region: z.string().optional(),
      district: z.string().optional(),
      technology: z.enum(["2G", "3G", "4G", "5G"]).optional(),
      status: z.enum(["active", "inactive", "maintenance"]).optional(),
      limit: z.number().int().min(1).max(100).default(20)
    })
  },
  async ({ region, district, technology, status, limit }) => {
    const sites = await getSites();
    const result = sites.filter(s =>
      (!region || s.region.toLowerCase().includes(region.toLowerCase())) &&
      (!district || s.district.toLowerCase().includes(district.toLowerCase())) &&
      (!technology || s.technology.includes(technology)) &&
      (!status || s.status === status)
    ).slice(0, limit);
    return output({ count: result.length, sites: result });
  }
);

server.registerTool(
  "get_microwave_link",
  {
    title: "Get microwave link",
    description: "Find microwave links by ID, region, endpoint district, operational status, maximum availability or capacity.",
    inputSchema: z.object({
      linkId: z.string().optional(),
      region: z.string().optional(),
      district: z.string().optional(),
      status: z.enum(["up", "down", "degraded"]).optional(),
      maxAvailabilityPct: z.number().min(0).max(100).optional(),
      maxCapacityMbps: z.number().positive().optional(),
      limit: z.number().int().min(1).max(100).default(20)
    })
  },
  async ({ linkId, region, district, status, maxAvailabilityPct, maxCapacityMbps, limit }) => {
    const [links, sites] = await Promise.all([getLinks(), getSites()]);
    const siteById = new Map(sites.map(site => [site.siteId.toLowerCase(), site]));
    const result = links.filter(l =>
      (!linkId || l.linkId.toLowerCase() === linkId.toLowerCase()) &&
      (!region || l.region.toLowerCase().includes(region.toLowerCase())) &&
      (!status || l.status === status) &&
      (!district || [l.siteA, l.siteB].some(siteId => siteById.get(siteId.toLowerCase())?.district.toLowerCase().includes(district.toLowerCase()))) &&
      (maxAvailabilityPct === undefined || l.availabilityPct <= maxAvailabilityPct) &&
      (maxCapacityMbps === undefined || l.capacityMbps < maxCapacityMbps)
    ).slice(0, limit);
    return output({ count: result.length, links: result });
  }
);

server.registerTool(
  "get_capacity_by_region",
  {
    title: "Get configured capacity by region",
    description: "Summarize configured microwave capacity by region. For routes listed in multiple regions (separated by '/'), capacity is split equally across those regions so regional totals add up to the network total.",
    inputSchema: z.object({})
  },
  async () => {
    const links = await getLinks();
    const capacity = new Map<string, { linkCount: number; capacityMbps: number }>();
    for (const link of links) {
      const regions = [...new Set(link.region.split("/").map(value => value.trim()).filter(Boolean))];
      if (regions.length === 0) continue;
      const share = link.capacityMbps / regions.length;
      for (const region of regions) {
        const current = capacity.get(region) ?? { linkCount: 0, capacityMbps: 0 };
        current.linkCount += 1;
        current.capacityMbps += share;
        capacity.set(region, current);
      }
    }
    const regions = [...capacity.entries()]
      .map(([region, values]) => ({ region, linkCount: values.linkCount, configuredCapacityMbps: Number(values.capacityMbps.toFixed(2)) }))
      .sort((a, b) => a.region.localeCompare(b.region));
    return output({
      regions,
      networkConfiguredCapacityMbps: links.reduce((total, link) => total + link.capacityMbps, 0),
      allocationMethod: "Capacity for a link spanning multiple slash-separated regions is split equally."
    });
  }
);

server.registerTool(
  "analyze_microwave_capacity",
  {
    title: "Analyze microwave capacity",
    description: "Analyze microwave links using capacity and utilization. Flags links whose utilization meets or exceeds the supplied threshold (default 80%). This is a screening indicator, not an engineering design approval.",
    inputSchema: z.object({
      utilizationThresholdPct: z.number().min(1).max(100).default(80),
      region: z.string().optional()
    })
  },
  async ({ utilizationThresholdPct, region }) => {
    const links = (await getLinks()).filter(l =>
      !region || l.region.toLowerCase().includes(region.toLowerCase())
    );
    const flagged = links.filter(l => l.utilizationPct >= utilizationThresholdPct);
    const totalCapacityMbps = links.reduce((sum, l) => sum + l.capacityMbps, 0);
    const averageUtilizationPct = links.length
      ? Number((links.reduce((sum, l) => sum + l.utilizationPct, 0) / links.length).toFixed(2))
      : 0;
    return output({
      totalLinks: links.length,
      totalConfiguredCapacityMbps: totalCapacityMbps,
      averageUtilizationPct,
      thresholdPct: utilizationThresholdPct,
      linksAboveThreshold: flagged.length,
      flaggedLinks: flagged,
      note: "Validate traffic direction, busy-hour measurement period, protection configuration and radio engineering constraints before making capacity decisions."
    });
  }
);

server.registerTool(
  "search_network_complaints",
  {
    title: "Search network complaints",
    description: "Find customer complaints by site, district, category and status; includes a count of matching complaints per site.",
    inputSchema: z.object({
      siteId: z.string().optional(),
      district: z.string().optional(),
      category: z.string().optional(),
      status: z.enum(["open", "resolved"]).optional(),
      limit: z.number().int().min(1).max(100).default(30)
    })
  },
  async ({ siteId, district, category, status, limit }) => {
    const [complaints, sites] = await Promise.all([getComplaints(), getSites()]);
    const siteById = new Map(sites.map(site => [site.siteId.toLowerCase(), site]));
    const matches = complaints.filter(complaint => {
      const site = siteById.get(complaint.siteId.toLowerCase());
      return (!siteId || complaint.siteId.toLowerCase() === siteId.toLowerCase()) &&
        (!district || site?.district.toLowerCase().includes(district.toLowerCase())) &&
        (!category || complaint.category.toLowerCase().includes(category.toLowerCase())) &&
        (!status || complaint.status === status);
    });
    const countBySite = new Map<string, number>();
    for (const complaint of matches) countBySite.set(complaint.siteId, (countBySite.get(complaint.siteId) ?? 0) + 1);
    const complaintsBySite = [...countBySite.entries()]
      .map(([id, count]) => ({
        siteId: id,
        siteName: siteById.get(id.toLowerCase())?.siteName ?? "Unknown site",
        district: siteById.get(id.toLowerCase())?.district ?? "Unknown",
        count
      }))
      .sort((a, b) => b.count - a.count);
    return output({ count: matches.length, complaints: matches.slice(0, limit), complaintsBySite });
  }
);

server.registerTool(
  "compare_network_performance",
  {
    title: "Compare monthly network performance",
    description: "Compare sample or MongoDB monthly regional traffic, throughput, utilization and availability records for two months.",
    inputSchema: z.object({
      fromMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format"),
      toMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format"),
      region: z.string().optional()
    }).refine(value => value.fromMonth !== value.toMonth, {
      message: "Choose two different months."
    })
  },
  async ({ fromMonth, toMonth, region }) => {
    const records = (await getMonthlyPerformance()).filter(record =>
      !region || record.region.toLowerCase().includes(region.toLowerCase())
    );
    const summarize = (month: string) => {
      const rows = records.filter(record => record.month === month);
      if (rows.length === 0) throw new Error(`No performance data available for ${month}${region ? ` in ${region}` : ""}.`);
      return {
        regionCount: rows.length,
        trafficMbps: rows.reduce((total, row) => total + row.trafficMbps, 0),
        throughputMbps: rows.reduce((total, row) => total + row.throughputMbps, 0),
        averageUtilizationPct: Number((rows.reduce((total, row) => total + row.utilizationPct, 0) / rows.length).toFixed(2)),
        averageAvailabilityPct: Number((rows.reduce((total, row) => total + row.availabilityPct, 0) / rows.length).toFixed(3))
      };
    };
    const from = summarize(fromMonth);
    const to = summarize(toMonth);
    const delta = (before: number, after: number) => Number((after - before).toFixed(3));
    return output({
      fromMonth: { month: fromMonth, ...from },
      toMonth: { month: toMonth, ...to },
      change: {
        trafficMbps: delta(from.trafficMbps, to.trafficMbps),
        throughputMbps: delta(from.throughputMbps, to.throughputMbps),
        averageUtilizationPct: delta(from.averageUtilizationPct, to.averageUtilizationPct),
        averageAvailabilityPct: delta(from.averageAvailabilityPct, to.averageAvailabilityPct)
      },
      note: "Sample regional averages are unweighted; use consistent measurement windows and traffic definitions for operational comparisons."
    });
  }
);

server.registerTool(
  "get_sites_geojson",
  {
    title: "Get site locations as GeoJSON",
    description: "Return network sites with coordinates as a GeoJSON FeatureCollection, optionally filtered by region or district.",
    inputSchema: z.object({
      region: z.string().optional(),
      district: z.string().optional()
    })
  },
  async ({ region, district }) => {
    const sites = (await getSites()).filter(site =>
      site.latitude !== undefined && site.longitude !== undefined &&
      (!region || site.region.toLowerCase().includes(region.toLowerCase())) &&
      (!district || site.district.toLowerCase().includes(district.toLowerCase()))
    );
    return output({
      type: "FeatureCollection",
      features: sites.map(site => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [site.longitude, site.latitude] },
        properties: {
          siteId: site.siteId,
          siteName: site.siteName,
          district: site.district,
          region: site.region,
          technology: site.technology,
          status: site.status
        }
      }))
    });
  }
);

server.registerTool(
  "search_network_alarms",
  {
    title: "Search network alarms",
    description: "Search network alarms by severity, status, site ID or link ID. Returns up to 100 matching alarms.",
    inputSchema: z.object({
      severity: z.enum(["critical", "major", "minor", "warning"]).optional(),
      status: z.enum(["open", "cleared"]).optional(),
      siteId: z.string().optional(),
      linkId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(30)
    })
  },
  async ({ severity, status, siteId, linkId, limit }) => {
    const alarms = await getAlarms();
    const result = alarms.filter(a =>
      (!severity || a.severity === severity) &&
      (!status || a.status === status) &&
      (!siteId || a.siteId.toLowerCase() === siteId.toLowerCase()) &&
      (!linkId || a.linkId?.toLowerCase() === linkId.toLowerCase())
    ).slice(0, limit);
    return output({ count: result.length, alarms: result });
  }
);

server.registerTool(
  "generate_network_report",
  {
    title: "Generate network engineering report",
    description: "Generate a sample-data engineering summary with network status, low-availability links, high-utilization links, open complaints and alarms.",
    inputSchema: z.object({
      region: z.string().optional(),
      lowAvailabilityThresholdPct: z.number().min(0).max(100).default(99),
      highUtilizationThresholdPct: z.number().min(0).max(100).default(80)
    })
  },
  async ({ region, lowAvailabilityThresholdPct, highUtilizationThresholdPct }) => {
    const [sites, allLinks, alarms, complaints] = await Promise.all([getSites(), getLinks(), getAlarms(), getComplaints()]);
    const links = allLinks.filter(link => !region || link.region.toLowerCase().includes(region.toLowerCase()));
    const scopedSiteIds = new Set(sites
      .filter(site => !region || site.region.toLowerCase().includes(region.toLowerCase()))
      .map(site => site.siteId.toLowerCase()));
    const lowAvailabilityLinks = links.filter(link => link.availabilityPct < lowAvailabilityThresholdPct);
    const highUtilizationLinks = links.filter(link => link.utilizationPct >= highUtilizationThresholdPct);
    const openAlarms = alarms.filter(alarm => alarm.status === "open" && scopedSiteIds.has(alarm.siteId.toLowerCase()));
    const openComplaints = complaints.filter(complaint => complaint.status === "open" && scopedSiteIds.has(complaint.siteId.toLowerCase()));
    const report = [
      "# Telecom Network Engineering Report",
      "",
      `- Scope: ${region ?? "All regions"}`,
      `- Data: ${process.env.MONGODB_URI ? "MongoDB" : "fictional built-in sample data"}`,
      `- Sites in scope: ${sites.filter(site => !region || site.region.toLowerCase().includes(region.toLowerCase())).length}`,
      `- Microwave links in scope: ${links.length}`,
      `- Configured microwave capacity: ${links.reduce((total, link) => total + link.capacityMbps, 0)} Mbps`,
      `- Open alarms: ${openAlarms.length}`,
      `- Open complaints: ${openComplaints.length}`,
      "",
      `## Links below ${lowAvailabilityThresholdPct}% availability`,
      lowAvailabilityLinks.length
        ? lowAvailabilityLinks.map(link => `- ${link.linkId}: ${link.availabilityPct}% (${link.status})`).join("\n")
        : "- None",
      "",
      `## Links at or above ${highUtilizationThresholdPct}% utilization`,
      highUtilizationLinks.length
        ? highUtilizationLinks.map(link => `- ${link.linkId}: ${link.utilizationPct}% (${link.capacityMbps} Mbps configured)`).join("\n")
        : "- None",
      "",
      "Sample data is fictional; validate source data and engineering assumptions before operational decisions."
    ].join("\n");
    return output({
      generatedAt: new Date().toISOString(),
      format: "markdown",
      report,
      findings: {
        lowAvailabilityLinks: lowAvailabilityLinks.length,
        highUtilizationLinks: highUtilizationLinks.length,
        openAlarms: openAlarms.length,
        openComplaints: openComplaints.length
      }
    });
  }
);

server.registerTool(
  "get_network_summary",
  {
    title: "Get network summary",
    description: "Return a high-level read-only summary of sites, microwave links, link states and open alarms.",
    inputSchema: z.object({})
  },
  async () => {
    return output(await getNetworkSummary());
  }
);

async function main() {
  await connectDatabase();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Telecom Network MCP server is running over stdio.");
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});

main().catch(async error => {
  console.error("Failed to start Telecom Network MCP:", error);
  await closeDatabase();
  process.exit(1);
});
