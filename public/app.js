const initialQuery = new URLSearchParams(location.search);
const state = {
  data: null,
  view: "overview",
  report: "",
  geojson: null,
  lastLoaded: null,
  performanceFilters: {
    from: initialQuery.get("from") || "",
    to: initialQuery.get("to") || "",
    region: initialQuery.get("region") || ""
  },
  geoFilters: {
    region: initialQuery.get("geoRegion") || "",
    district: initialQuery.get("district") || ""
  }
};

const page = document.querySelector("#page-content");
const nav = document.querySelector(".navigation");
const titles = {
  overview: "Overview",
  sites: "Sites & RAN",
  microwave: "Microwave",
  faults: "Faults & complaints",
  performance: "Performance",
  gis: "GIS & reports"
};
const text = value => String(value ?? "");
const esc = value => text(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const lower = value => text(value).trim().toLowerCase();
const number = value => Number(value || 0).toLocaleString("en-US");
const percent = value => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const includes = (value, query) => !query || lower(value).includes(lower(query));

function toast(message, error = false) {
  const element = document.createElement("div");
  element.className = `toast${error ? " error" : ""}`;
  element.textContent = message;
  document.querySelector("#toast-region").append(element);
  setTimeout(() => element.remove(), 3500);
}

function setConnection(status, label) {
  const stateElement = document.querySelector(".connection-state");
  stateElement.classList.toggle("online", status === "online");
  stateElement.classList.toggle("error", status === "error");
  document.querySelector("#connection-label").textContent = label;
}

async function loadData({ quiet = false } = {}) {
  const button = document.querySelector("#refresh-button");
  button.disabled = true;
  setConnection("loading", "Loading data");
  if (!state.data) page.innerHTML = '<div class="loading-state"><span class="spinner"></span><p>Loading network data…</p></div>';
  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    state.data = payload;
    state.lastLoaded = new Date();
    setConnection("online", payload.dataSource);
    render();
    if (quiet) toast("Network data refreshed.");
  } catch (error) {
    setConnection("error", "Data unavailable");
    if (!state.data) {
      page.innerHTML = `<div class="error-state"><strong>Could not load network data</strong><p>${esc(error.message)}</p><button class="button button-primary" data-action="refresh">Try again</button></div>`;
    } else {
      toast(error.message, true);
    }
  } finally {
    button.disabled = false;
  }
}

function heading(kicker, title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}

function panel(title, body, options = {}) {
  const subtitle = options.subtitle ? `<p>${esc(options.subtitle)}</p>` : "";
  const actions = options.actions ?? "";
  return `<section class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2>${subtitle}</div>${actions}</div><div class="panel-body${options.flush ? " flush" : ""}">${body}</div></section>`;
}

function stat(label, value, note, icon, tone = "") {
  return `<article class="stat-card"><div class="stat-top"><span>${esc(label)}</span><span class="stat-icon ${tone}">${esc(icon)}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${esc(note)}</div></article>`;
}

function badge(value) {
  const safe = lower(value).replace(/[^a-z0-9-]/g, "");
  return `<span class="badge ${safe}">${esc(value)}</span>`;
}

function statusTable(rows, type = "links") {
  if (!rows.length) return '<div class="empty-cell">No records match these filters.</div>';
  if (type === "sites") return `<div class="table-wrap"><table><thead><tr><th>Site</th><th>District</th><th>Region</th><th>Technology</th><th>Status</th></tr></thead><tbody>${rows.map(site => `<tr><td><span class="primary-cell">${esc(site.siteName)}</span><span class="secondary-cell">${esc(site.siteId)}</span></td><td>${esc(site.district)}</td><td>${esc(site.region)}</td><td>${site.technology.map(tech => `<span class="badge">${esc(tech)}</span>`).join(" ")}</td><td>${badge(site.status)}</td></tr>`).join("")}</tbody></table></div>`;
  if (type === "alarms") return `<div class="table-wrap"><table><thead><tr><th>Alarm</th><th>Site / link</th><th>Severity</th><th>Description</th><th>Opened</th><th>Status</th></tr></thead><tbody>${rows.map(item => `<tr><td><span class="primary-cell">${esc(item.alarmId)}</span></td><td>${esc(item.siteId)}${item.linkId ? `<span class="secondary-cell">${esc(item.linkId)}</span>` : ""}</td><td>${badge(item.severity)}</td><td>${esc(item.description)}</td><td>${esc(item.openedAt)}</td><td>${badge(item.status)}</td></tr>`).join("")}</tbody></table></div>`;
  if (type === "complaints") return `<div class="table-wrap"><table><thead><tr><th>Complaint</th><th>Site</th><th>Category</th><th>Description</th><th>Opened</th><th>Status</th></tr></thead><tbody>${rows.map(item => `<tr><td><span class="primary-cell">${esc(item.complaintId)}</span></td><td>${esc(item.siteId)}</td><td>${esc(item.category)}</td><td>${esc(item.description)}</td><td>${esc(item.openedAt)}</td><td>${badge(item.status)}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Link</th><th>Endpoints</th><th>Region</th><th>Frequency</th><th>Capacity</th><th>Utilization</th><th>Availability</th><th>Status</th></tr></thead><tbody>${rows.map(link => `<tr><td><span class="primary-cell">${esc(link.linkId)}</span></td><td>${esc(link.siteA)} → ${esc(link.siteB)}</td><td>${esc(link.region)}</td><td>${esc(link.frequencyGHz)} GHz</td><td>${number(link.capacityMbps)} Mbps</td><td><div class="primary-cell">${percent(link.utilizationPct)}</div><div class="meter ${link.utilizationPct >= 80 ? "hot" : ""}"><span style="width:${Math.min(100, Math.max(0, link.utilizationPct))}%"></span></div></td><td>${percent(link.availabilityPct)}</td><td>${badge(link.status)}</td></tr>`).join("")}</tbody></table></div>`;
}

function capacityByRegion(links = state.data.links) {
  const regions = new Map();
  for (const link of links) {
    const names = [...new Set(text(link.region).split("/").map(value => value.trim()).filter(Boolean))];
    if (!names.length) continue;
    for (const region of names) {
      const current = regions.get(region) || { links: 0, capacity: 0 };
      current.links += 1;
      current.capacity += Number(link.capacityMbps) / names.length;
      regions.set(region, current);
    }
  }
  return [...regions.entries()].map(([region, values]) => ({ region, ...values }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

function regionsMarkup(regions) {
  if (!regions.length) return '<div class="empty-cell">No regional capacity data.</div>';
  const max = Math.max(...regions.map(row => row.capacity), 1);
  return `<div class="region-list">${regions.map(row => `<div class="region-row"><span class="region-name">${esc(row.region)}</span><span class="region-track"><span style="width:${Math.max(1, row.capacity / max * 100)}%"></span></span><span class="region-value">${number(row.capacity)} Mbps</span></div>`).join("")}</div>`;
}

function monthlyChart(records) {
  const months = [...new Set(records.map(row => row.month))].sort();
  if (!months.length) return '<div class="empty-cell">No monthly performance data.</div>';
  const values = months.flatMap(month => records.filter(row => row.month === month).reduce((sum, row) => [sum[0] + row.trafficMbps, sum[1] + row.throughputMbps], [0, 0]));
  const max = Math.max(...values, 1);
  return `<div class="chart-bars">${months.map(month => {
    const rows = records.filter(row => row.month === month);
    const traffic = rows.reduce((sum, row) => sum + row.trafficMbps, 0);
    const throughput = rows.reduce((sum, row) => sum + row.throughputMbps, 0);
    return `<div class="chart-group"><span class="chart-bar" title="Traffic: ${number(traffic)} Mbps" style="height:${Math.max(3, traffic / max * 100)}%"></span><span class="chart-bar secondary" title="Throughput: ${number(throughput)} Mbps" style="height:${Math.max(3, throughput / max * 100)}%"></span><span class="chart-label">${esc(month)}</span></div>`;
  }).join("")}</div><div class="legend"><span><i></i>Traffic</span><span><i class="blue"></i>Throughput</span></div>`;
}

function renderOverview() {
  const { sites, links, alarms, complaints, monthlyPerformance } = state.data;
  const openAlarms = alarms.filter(row => row.status === "open");
  const openComplaints = complaints.filter(row => row.status === "open");
  const issueLinks = links.filter(row => row.availabilityPct < 99 || row.utilizationPct >= 80);
  const complaintCounts = new Map();
  openComplaints.forEach(row => complaintCounts.set(row.siteId, (complaintCounts.get(row.siteId) || 0) + 1));
  const topComplaintSites = [...complaintCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const recent = [...openAlarms].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 4);
  const latestMonth = [...new Set(monthlyPerformance.map(row => row.month))].sort().at(-1);
  const latestRows = monthlyPerformance.filter(row => row.month === latestMonth);
  const avgUtil = latestRows.length ? latestRows.reduce((total, row) => total + row.utilizationPct, 0) / latestRows.length : 0;
  return `${heading("NETWORK OPERATIONS", "Network overview", "A live snapshot of your network inventory, microwave health and customer-impact signals.", `<button class="button" data-action="csv" data-kind="links">Export links CSV</button>`)}
    <div class="grid stat-grid">
      ${stat("Network sites", number(sites.length), `${sites.filter(s => s.status === "active").length} active · ${sites.filter(s => s.status === "maintenance").length} in maintenance`, "⌖", "blue")}
      ${stat("Microwave links", number(links.length), `${links.filter(l => l.status === "up").length} up · ${links.filter(l => l.status === "degraded").length} degraded`, "⌁")}
      ${stat("Configured capacity", `${number(links.reduce((sum, link) => sum + Number(link.capacityMbps), 0))} Mbps`, "Across all microwave links", "↗", "blue")}
      ${stat("Open alarms", number(openAlarms.length), `${openAlarms.filter(a => a.severity === "critical" || a.severity === "major").length} critical / major`, "◇", "red")}
    </div>
    <div class="grid two-grid">
      ${panel("Microwave capacity by region", `<p class="panel-subtitle">Cross-region links are split equally across their listed regions.</p>${regionsMarkup(capacityByRegion())}`, { subtitle: "Configured capacity · Mbps", actions: `<button class="button" data-view="microwave">View microwave</button>` })}
      ${panel("Network performance trend", monthlyChart(monthlyPerformance), { subtitle: "Monthly traffic and throughput · Mbps", actions: `<span class="badge">${esc(latestMonth || "No data")} · ${percent(avgUtil)} util.</span>` })}
    </div>
    <div class="grid two-grid" style="margin-top:15px">
      ${panel("Links needing attention", issueLinks.length ? statusTable(issueLinks) : '<div class="empty-cell">No links currently match the attention thresholds.</div>', { subtitle: "Availability below 99% or utilization at/above 80%", actions: `<button class="button" data-view="microwave">Analyze links</button>`, flush: true })}
      ${panel("Open customer complaints", topComplaintSites.length ? `<div class="mini-list">${topComplaintSites.map(([siteId, count]) => { const site = sites.find(row => row.siteId === siteId); return `<div class="mini-item"><div><strong>${esc(site?.siteName || siteId)}</strong><small>${esc(site?.district || "Unknown district")} · ${count} open complaints</small></div><span class="mini-count">${count}</span></div>`; }).join("")}</div>` : '<div class="empty-cell">No open complaints.</div>', { subtitle: `${openComplaints.length} open complaint records`, actions: `<button class="button" data-view="faults">View faults</button>` })}
    </div>
    <div class="grid two-grid" style="margin-top:15px">
      ${panel("Latest open alarms", recent.length ? statusTable(recent, "alarms") : '<div class="empty-cell">No open alarms.</div>', { subtitle: "Most recent records", actions: `<button class="button" data-view="faults">All alarms</button>`, flush: true })}
      ${panel("Network status", `<div class="region-list">${[
        ["Site availability", sites.length ? `${Math.round(sites.filter(site => site.status === "active").length / sites.length * 100)}% active` : "—"],
        ["Link availability", links.length ? percent(links.reduce((sum, link) => sum + link.availabilityPct, 0) / links.length) : "—"],
        ["Open complaints", number(openComplaints.length)],
        ["Data source", state.data.dataSource]
      ].map(([label, value]) => `<div class="region-row"><span class="region-name">${esc(label)}</span><span class="region-track"><span style="width:${label.includes("availability") && value !== "—" ? parseFloat(value) : 100}%"></span></span><span class="region-value">${esc(value)}</span></div>`).join("")}</div><p class="data-note" style="margin:15px 0 0">Updated ${esc(state.lastLoaded?.toLocaleTimeString() || "just now")}. Sample records are fictional demo data.</p>`, { subtitle: "Read-only data snapshot" })}
    </div>`;
}

function field(label, input, grow = false) {
  return `<div class="field${grow ? " field-grow" : ""}"><label>${esc(label)}</label>${input}</div>`;
}

function selectOptions(items, allLabel, selected = "") {
  return `<option value=""${selected ? "" : " selected"}>${esc(allLabel)}</option>${items.map(value => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`).join("")}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b)));
}

function renderSites() {
  const sites = state.data.sites;
  const regions = unique(sites.map(site => site.region));
  const rows = sites.filter(site =>
    includes(`${site.siteId} ${site.siteName}`, document.querySelector("#site-search")?.value) &&
    includes(site.region, document.querySelector("#site-region")?.value) &&
    includes(site.district, document.querySelector("#site-district")?.value) &&
    (!document.querySelector("#site-tech")?.value || site.technology.includes(document.querySelector("#site-tech").value)) &&
    (!document.querySelector("#site-status")?.value || site.status === document.querySelector("#site-status").value)
  );
  return `${heading("RADIO ACCESS NETWORK", "Sites & RAN", "Browse telecom sites by region, district, technology and operational status.", `<button class="button" data-action="csv" data-kind="sites">Export sites CSV</button>`)}
    <section class="panel"><form class="filters" id="site-filters">
      ${field("Search sites", '<input id="site-search" name="search" placeholder="Site ID or name">', true)}
      ${field("Region", `<select id="site-region">${selectOptions(regions, "All regions")}</select>`)}
      ${field("District", `<select id="site-district">${selectOptions(unique(sites.map(site => site.district)), "All districts")}</select>`)}
      ${field("Technology", `<select id="site-tech">${selectOptions(["2G", "3G", "4G", "5G"], "All technologies")}</select>`)}
      ${field("Status", '<select id="site-status"><option value="">All statuses</option><option>active</option><option>inactive</option><option>maintenance</option></select>')}
      <div class="filter-actions"><button class="button button-primary" type="submit">Apply filters</button><button class="button" type="reset">Reset</button></div>
    </form><div id="site-results">${statusTable(rows, "sites")}<div class="table-meta"><span>${rows.length} of ${sites.length} sites</span><span>Inventory is read-only</span></div></div></section>
    <div class="grid two-grid" style="margin-top:15px">${panel("Technology footprint", `<div class="region-list">${["2G", "3G", "4G", "5G"].map(tech => { const count = sites.filter(site => site.technology.includes(tech)).length; return `<div class="region-row"><span class="region-name">${tech}</span><span class="region-track"><span style="width:${sites.length ? count / sites.length * 100 : 0}%"></span></span><span class="region-value">${count} sites</span></div>`; }).join("")}</div>`)}${panel("Site status", `<div class="mini-list">${["active", "maintenance", "inactive"].map(status => `<div class="mini-item"><div><strong>${status[0].toUpperCase()}${status.slice(1)}</strong><small>Current operational status</small></div>${badge(status)}<span class="mini-count">${sites.filter(site => site.status === status).length}</span></div>`).join("")}</div>`)}</div>`;
}

function renderMicrowave() {
  const links = state.data.links;
  const regions = unique(links.flatMap(link => link.region.split("/").map(value => value.trim())));
  const rows = links.filter(link => {
    const district = document.querySelector("#link-district")?.value;
    const siteMap = new Map(state.data.sites.map(site => [site.siteId.toLowerCase(), site]));
    const inDistrict = !district || [link.siteA, link.siteB].some(id => includes(siteMap.get(id.toLowerCase())?.district, district));
    const availability = document.querySelector("#link-availability")?.value;
    const capacity = document.querySelector("#link-capacity")?.value;
    return includes(link.linkId, document.querySelector("#link-search")?.value) &&
      includes(link.region, document.querySelector("#link-region")?.value) &&
      inDistrict &&
      (!document.querySelector("#link-status")?.value || link.status === document.querySelector("#link-status").value) &&
      (!availability || Number(link.availabilityPct) <= Number(availability)) &&
      (!capacity || Number(link.capacityMbps) < Number(capacity));
  });
  const threshold = Number(document.querySelector("#util-threshold")?.value || 80);
  const flagged = links.filter(link => Number(link.utilizationPct) >= threshold);
  const regional = capacityByRegion(links);
  return `${heading("TRANSMISSION", "Microwave network", "Inspect link paths, radio parameters, availability and utilization. Use filters to identify capacity or availability risks.", `<button class="button" data-action="csv" data-kind="links">Export links CSV</button>`)}
    <div class="grid stat-grid">${stat("Total links", links.length, `${links.filter(l => l.status === "up").length} operational`, "⌁", "blue")}${stat("Configured capacity", `${number(links.reduce((sum, link) => sum + Number(link.capacityMbps), 0))} Mbps`, "Full network total", "↗")}${stat("Average availability", percent(links.length ? links.reduce((sum, link) => sum + Number(link.availabilityPct), 0) / links.length : 0), "Across configured links", "◷", "blue")}${stat("Above utilization threshold", flagged.length, `Threshold: ${threshold}%`, "!", flagged.length ? "orange" : "")}</div>
    <section class="panel"><form class="filters" id="link-filters">
      ${field("Link ID", '<input id="link-search" placeholder="e.g. MW-1002">', true)}
      ${field("Region", `<select id="link-region">${selectOptions(regions, "All regions")}</select>`)}
      ${field("Endpoint district", `<select id="link-district">${selectOptions(unique(state.data.sites.map(site => site.district)), "All districts")}</select>`)}
      ${field("Status", '<select id="link-status"><option value="">All statuses</option><option>up</option><option>down</option><option>degraded</option></select>')}
      ${field("Availability at most %", '<input id="link-availability" type="number" min="0" max="100" step="0.01" placeholder="e.g. 99">')}
      ${field("Capacity below Mbps", '<input id="link-capacity" type="number" min="1" step="1" placeholder="e.g. 500">')}
      <div class="filter-actions"><button class="button button-primary" type="submit">Apply filters</button><button class="button" type="reset">Reset</button></div>
    </form><div id="link-results">${statusTable(rows)}<div class="table-meta"><span>${rows.length} of ${links.length} links</span><span>District filter matches either endpoint site</span></div></div></section>
    <div class="grid two-grid" style="margin-top:15px">
      ${panel("Capacity screening", `<form class="filters" id="capacity-form" style="padding:0 0 14px;border:0;background:transparent">${field("Utilization threshold %", `<input id="util-threshold" name="threshold" type="number" min="1" max="100" value="${threshold}">`)}${field("Region", `<select id="capacity-region" name="region">${selectOptions(regions, "All regions")}</select>`)}<button class="button button-primary" type="submit">Run analysis</button></form><div id="capacity-results">${capacityResults(links, threshold, "")}</div><p class="data-note">Screening indicator only. Validate busy-hour traffic, radio configuration and engineering constraints before decisions.</p>`)}
      ${panel("Configured capacity by region", `${regionsMarkup(regional)}<p class="data-note" style="margin:14px 0 0">Network total: ${number(links.reduce((sum, link) => sum + Number(link.capacityMbps), 0))} Mbps. Multi-region links are allocated equally across listed regions.</p>`)}
    </div>`;
}

function capacityResults(links, threshold, region) {
  const scoped = links.filter(link => includes(link.region, region));
  const flagged = scoped.filter(link => Number(link.utilizationPct) >= threshold);
  return `<div class="mini-list"><div class="mini-item"><div><strong>${flagged.length} links at or above ${esc(threshold)}%</strong><small>${scoped.length} links in the selected scope</small></div><span class="mini-count">${flagged.length}</span></div>${flagged.length ? flagged.map(link => `<div class="mini-item"><div><strong>${esc(link.linkId)} · ${percent(link.utilizationPct)}</strong><small>${esc(link.siteA)} → ${esc(link.siteB)} · ${number(link.capacityMbps)} Mbps</small></div>${badge(link.status)}</div>`).join("") : '<div class="data-note">No links meet the selected threshold.</div>'}</div>`;
}

function renderFaults() {
  const alarms = state.data.alarms;
  const complaints = state.data.complaints;
  const alarmRows = alarms.filter(item =>
    (!document.querySelector("#alarm-severity")?.value || item.severity === document.querySelector("#alarm-severity").value) &&
    (!document.querySelector("#alarm-status")?.value || item.status === document.querySelector("#alarm-status").value) &&
    includes(item.siteId, document.querySelector("#alarm-site")?.value) &&
    includes(item.linkId, document.querySelector("#alarm-link")?.value)
  );
  const complaintRows = complaints.filter(item =>
    (!document.querySelector("#complaint-status")?.value || item.status === document.querySelector("#complaint-status").value) &&
    includes(item.category, document.querySelector("#complaint-category")?.value) &&
    includes(item.siteId, document.querySelector("#complaint-site")?.value) &&
    (!document.querySelector("#complaint-district")?.value || state.data.sites.some(site => site.siteId === item.siteId && site.district === document.querySelector("#complaint-district").value))
  );
  const openBySite = new Map();
  complaints.filter(item => item.status === "open").forEach(item => openBySite.set(item.siteId, (openBySite.get(item.siteId) || 0) + 1));
  const siteCounts = [...openBySite.entries()].sort((a, b) => b[1] - a[1]);
  return `${heading("SERVICE ASSURANCE", "Faults & complaints", "Investigate active alarms alongside customer-reported issues and identify sites with complaint clusters.", `<button class="button" data-action="csv" data-kind="alarms">Export alarms CSV</button><button class="button" data-action="csv" data-kind="complaints">Export complaints CSV</button>`)}
    <div class="grid stat-grid">${stat("Open alarms", alarms.filter(a => a.status === "open").length, `${alarms.filter(a => a.status === "open" && a.severity === "major").length} major · ${alarms.filter(a => a.status === "open" && a.severity === "critical").length} critical`, "◇", "red")}${stat("Open complaints", complaints.filter(c => c.status === "open").length, `${complaints.length} total records`, "!", "orange")}${stat("Sites with multiple complaints", siteCounts.filter(([, count]) => count > 1).length, "More than one open complaint", "⌖", "blue")}${stat("Cleared / resolved", alarms.filter(a => a.status === "cleared").length + complaints.filter(c => c.status === "resolved").length, "Alarms and complaints", "✓")}</div>
    <section class="panel"><div class="panel-head"><div><h2>Network alarms</h2><p>Filter severity, status, site and associated link.</p></div><span class="badge">${alarmRows.length} records</span></div><form class="filters" id="alarm-filters">
      ${field("Severity", '<select id="alarm-severity"><option value="">All severities</option><option>critical</option><option>major</option><option>minor</option><option>warning</option></select>')}
      ${field("Status", '<select id="alarm-status"><option value="">All statuses</option><option>open</option><option>cleared</option></select>')}
      ${field("Site ID", '<input id="alarm-site" placeholder="e.g. KTM-001">')}
      ${field("Link ID", '<input id="alarm-link" placeholder="e.g. MW-1002">')}
      <div class="filter-actions"><button class="button button-primary" type="submit">Filter alarms</button><button class="button" type="reset">Reset</button></div>
    </form><div id="alarm-results">${statusTable(alarmRows, "alarms")}<div class="table-meta"><span>${alarmRows.length} of ${alarms.length} alarms</span><span>Read-only fault data</span></div></div></section>
    <div class="grid two-grid" style="margin-top:15px">
      ${panel("Customer complaints", `<form class="filters" id="complaint-filters" style="padding:0 0 13px;border:0;background:transparent">
        ${field("Status", '<select id="complaint-status"><option value="">All statuses</option><option>open</option><option>resolved</option></select>')}
        ${field("District", `<select id="complaint-district">${selectOptions(unique(state.data.sites.map(site => site.district)), "All districts")}</select>`)}
        ${field("Category", `<select id="complaint-category">${selectOptions(unique(complaints.map(c => c.category)), "All categories")}</select>`)}
        ${field("Site ID", '<input id="complaint-site" placeholder="e.g. KTM-001">')}
        <button class="button button-primary" type="submit">Filter complaints</button><button class="button" type="reset">Reset</button>
      </form><div id="complaint-results">${statusTable(complaintRows, "complaints")}<div class="table-meta"><span>${complaintRows.length} of ${complaints.length} complaints</span></div></div>`, { flush: false })}
      ${panel("Complaint clusters by site", siteCounts.length ? `<div class="mini-list">${siteCounts.map(([siteId, count]) => { const site = state.data.sites.find(row => row.siteId === siteId); return `<div class="mini-item"><div><strong>${esc(site?.siteName || siteId)}</strong><small>${esc(site?.district || "Unknown")} · ${count} open complaints</small></div><span class="mini-count">${count}</span></div>`; }).join("")}</div>` : '<div class="empty-cell">No open complaints found.</div>', { subtitle: "Open complaints per site" })}
    </div>`;
}

function performanceSummary(month, region) {
  const records = state.data.monthlyPerformance.filter(row => row.month === month && includes(row.region, region));
  if (!records.length) return null;
  return {
    regionCount: records.length,
    trafficMbps: records.reduce((sum, row) => sum + Number(row.trafficMbps), 0),
    throughputMbps: records.reduce((sum, row) => sum + Number(row.throughputMbps), 0),
    averageUtilizationPct: records.reduce((sum, row) => sum + Number(row.utilizationPct), 0) / records.length,
    averageAvailabilityPct: records.reduce((sum, row) => sum + Number(row.availabilityPct), 0) / records.length
  };
}

function renderPerformance() {
  const records = state.data.monthlyPerformance;
  const months = unique(records.map(row => row.month)).sort();
  const from = state.performanceFilters.from || months[0] || "";
  const to = state.performanceFilters.to || months.at(-1) || "";
  const region = state.performanceFilters.region || "";
  const a = performanceSummary(from, region);
  const b = performanceSummary(to, region);
  const delta = (before, after) => (Number(after) - Number(before));
  const deltaCard = (label, before, after, formatter = number, deltaSuffix = "") => {
    const change = delta(before, after);
    return `<div class="comparison-card"><small>${esc(label)}</small><strong>${formatter(before)} → ${formatter(after)}</strong><span class="delta ${change < 0 ? "negative" : ""}">${change > 0 ? "+" : ""}${number(change)}${esc(deltaSuffix)} change</span></div>`;
  };
  return `${heading("NETWORK PERFORMANCE", "Monthly performance", "Compare regional traffic, throughput, utilization and availability using consistent sample month records.", `<button class="button" data-action="csv" data-kind="monthlyPerformance">Export performance CSV</button>`)}
    <div class="grid two-grid">
      ${panel("Compare two periods", `<form class="filters" id="performance-form" style="padding:0 0 15px;border:0;background:transparent">
        ${field("From month", `<select id="perf-from">${months.map(month => `<option value="${esc(month)}"${month === from ? " selected" : ""}>${esc(month)}</option>`).join("")}</select>`)}
        ${field("To month", `<select id="perf-to">${months.map(month => `<option value="${esc(month)}"${month === to ? " selected" : ""}>${esc(month)}</option>`).join("")}</select>`)}
        ${field("Region", `<select id="perf-region">${selectOptions(unique(records.map(row => row.region)), "All regions", region)}</select>`)}
        <button class="button button-primary" type="submit">Compare periods</button>
      </form>${a && b ? `<div class="comparison-grid">${deltaCard("Traffic · Mbps", a.trafficMbps, b.trafficMbps)}${deltaCard("Throughput · Mbps", a.throughputMbps, b.throughputMbps)}${deltaCard("Average utilization", a.averageUtilizationPct, b.averageUtilizationPct, value => percent(value), " pp")}${deltaCard("Average availability", a.averageAvailabilityPct, b.averageAvailabilityPct, value => percent(value), " pp")}</div><p class="data-note" style="margin:13px 0 0">Records per month: ${a.regionCount} → ${b.regionCount}. Regional performance averages are unweighted across available records.</p>` : '<div class="notice">No performance records are available for one or both selected periods and regions.</div>'}`, { subtitle: "Choose dates and an optional region" })}
      ${panel("Monthly traffic & throughput", monthlyChart(records), { subtitle: "Aggregated across included regions · Mbps" })}
    </div>
    ${panel("Monthly regional records", `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Region</th><th>Traffic</th><th>Throughput</th><th>Utilization</th><th>Availability</th></tr></thead><tbody>${records.map(row => `<tr><td><span class="primary-cell">${esc(row.month)}</span></td><td>${esc(row.region)}</td><td>${number(row.trafficMbps)} Mbps</td><td>${number(row.throughputMbps)} Mbps</td><td>${percent(row.utilizationPct)}</td><td>${percent(row.availabilityPct)}</td></tr>`).join("")}</tbody></table></div>`, { subtitle: "Underlying sample/collection data. Averages are unweighted.", actions: `<span class="badge">${records.length} records</span>`, flush: true })}`;
}

function geoJsonFor(region, district) {
  return {
    type: "FeatureCollection",
    features: state.data.sites.filter(site =>
      Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)) &&
      includes(site.region, region) && includes(site.district, district)
    ).map(site => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(site.longitude), Number(site.latitude)] },
      properties: { siteId: site.siteId, siteName: site.siteName, district: site.district, region: site.region, technology: site.technology, status: site.status }
    }))
  };
}

function mapMarkup(geojson) {
  if (!geojson.features.length) return '<div class="empty-cell">No sites with coordinates match these filters.</div>';
  const points = geojson.features;
  const lons = points.map(feature => feature.geometry.coordinates[0]);
  const lats = points.map(feature => feature.geometry.coordinates[1]);
  const minLon = Math.min(...lons) - .04, maxLon = Math.max(...lons) + .04;
  const minLat = Math.min(...lats) - .04, maxLat = Math.max(...lats) + .04;
  const x = lon => 55 + (lon - minLon) / Math.max(maxLon - minLon, .01) * 520;
  const y = lat => 245 - (lat - minLat) / Math.max(maxLat - minLat, .01) * 205;
  return `<div class="geo-map"><svg viewBox="0 0 630 280" role="img" aria-label="Local plot of site coordinates"><path class="map-land" d="M75 186 112 139 145 146 181 94 218 119 247 83 283 108 318 67 349 99 389 75 419 112 456 101 483 144 527 139 555 181 518 208 466 197 425 230 379 210 333 237 290 207 243 229 206 198 166 221 129 194Z"/><path class="map-grid" d="M40 70H590M40 120H590M40 170H590M40 220H590M150 35V255M250 35V255M350 35V255M450 35V255"/><g>${points.map(feature => { const [lon, lat] = feature.geometry.coordinates; const props = feature.properties; return `<g><title>${esc(props.siteName)} · ${esc(props.district)}</title><circle class="map-point" cx="${x(lon)}" cy="${y(lat)}" r="7"/><text x="${x(lon) + 10}" y="${y(lat) - 8}">${esc(props.siteId)}</text></g>`; }).join("")}</g></svg></div><div class="map-caption">Relative site coordinates only · not a surveyed or navigable basemap · ${points.length} mapped sites</div>`;
}

function renderGis() {
  const region = state.geoFilters.region || "";
  const district = state.geoFilters.district || "";
  const geojson = geoJsonFor(region, district);
  state.geojson = geojson;
  const sampleReport = state.report || "";
  return `${heading("SPATIAL & REPORTING", "GIS & engineering reports", "Inspect site coordinates, export GeoJSON and generate a shareable Markdown engineering summary.", `<button class="button" data-action="geojson">Download GeoJSON</button><button class="button" data-action="report-download" ${sampleReport ? "" : "disabled"}>Download report</button>`)}
    <div class="grid two-grid">
      ${panel("Site map & GeoJSON", `<form class="filters" id="geo-filters" style="padding:0 0 13px;border:0;background:transparent">${field("Region", `<select id="geo-region">${selectOptions(unique(state.data.sites.map(site => site.region)), "All regions", region)}</select>`)}${field("District", `<select id="geo-district">${selectOptions(unique(state.data.sites.map(site => site.district)), "All districts", district)}</select>`)}<button class="button button-primary" type="submit">Apply filters</button></form><div id="geo-map">${mapMarkup(geojson)}</div><details style="margin-top:12px"><summary class="data-note">Preview GeoJSON (${geojson.features.length} features)</summary><pre class="report-output" id="geo-preview">${esc(JSON.stringify(geojson, null, 2))}</pre></details>`, { subtitle: "WGS84 coordinates from the site inventory" })}
      ${panel("Engineering report", `<form class="filters" id="report-form" style="padding:0 0 14px;border:0;background:transparent">${field("Region scope", `<select id="report-region">${selectOptions(unique(state.data.sites.map(site => site.region)), "All regions")}</select>`)}${field("Low availability below %", '<input id="report-availability" type="number" min="0" max="100" step="0.01" value="99">')}${field("High utilization at/above %", '<input id="report-utilization" type="number" min="0" max="100" value="80">')}<button class="button button-primary" type="submit">Generate report</button></form><pre class="report-output" id="report-output">${sampleReport ? esc(sampleReport) : "Generate a report to see network status, low-availability links, high-utilization links, open alarms and customer complaints here."}</pre><p class="data-note" style="margin:12px 0 0">The network-engineering-report MCP prompt can guide an AI client to summarize the generated report. This page provides the same report inputs and findings.</p>`, { subtitle: "Markdown · read-only source data" })}
    </div>
    <div class="notice info" style="margin-top:15px"><span>ⓘ</span><span>Map coordinates are plotted locally without an external map service. Validate coordinate quality and source records before engineering or field decisions.</span></div>`;
}

function render() {
  if (!state.data) return;
  const renderers = {
    overview: renderOverview,
    sites: renderSites,
    microwave: renderMicrowave,
    faults: renderFaults,
    performance: renderPerformance,
    gis: renderGis
  };
  document.querySelector("#current-section").textContent = titles[state.view];
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
  page.innerHTML = renderers[state.view]();
}

function download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(kind) {
  const rows = state.data[kind];
  if (!rows?.length) return toast("There are no records to export.", true);
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [
    headers.map(value => `"${value.replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => headers.map(key => {
      const value = Array.isArray(row[key]) ? row[key].join("; ") : row[key];
      return `"${text(value).replace(/"/g, '""')}"`;
    }).join(","))
  ].join("\r\n");
  download(`telecom-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  toast(`${rows.length} ${kind} records exported.`);
}

function generateReport(form) {
  const region = form.querySelector("#report-region").value;
  const availabilityLimit = Number(form.querySelector("#report-availability").value);
  const utilizationLimit = Number(form.querySelector("#report-utilization").value);
  const sites = state.data.sites.filter(site => !region || includes(site.region, region));
  const siteIds = new Set(sites.map(site => lower(site.siteId)));
  const links = state.data.links.filter(link => !region || includes(link.region, region));
  const lowAvailability = links.filter(link => Number(link.availabilityPct) < availabilityLimit);
  const highUtilization = links.filter(link => Number(link.utilizationPct) >= utilizationLimit);
  const openAlarms = state.data.alarms.filter(item => item.status === "open" && siteIds.has(lower(item.siteId)));
  const openComplaints = state.data.complaints.filter(item => item.status === "open" && siteIds.has(lower(item.siteId)));
  const lines = [
    "# Telecom Network Engineering Report", "",
    `- Generated: ${new Date().toISOString()}`,
    `- Scope: ${region || "All regions"}`,
    `- Data source: ${state.data.dataSource}${state.data.dataSource === "built-in sample data" ? " (fictional demonstration data)" : ""}`,
    `- Sites in scope: ${sites.length}`,
    `- Microwave links in scope: ${links.length}`,
    `- Configured microwave capacity: ${number(links.reduce((sum, link) => sum + Number(link.capacityMbps), 0))} Mbps`,
    `- Open alarms: ${openAlarms.length}`,
    `- Open complaints: ${openComplaints.length}`, "",
    `## Links below ${availabilityLimit}% availability`,
    ...(lowAvailability.length ? lowAvailability.map(link => `- ${link.linkId}: ${link.availabilityPct}% (${link.status})`) : ["- None"]),
    "",
    `## Links at or above ${utilizationLimit}% utilization`,
    ...(highUtilization.length ? highUtilization.map(link => `- ${link.linkId}: ${link.utilizationPct}% (${link.capacityMbps} Mbps configured)`) : ["- None"]),
    "",
    "## Open major / critical alarms",
    ...(openAlarms.filter(item => ["major", "critical"].includes(item.severity)).length
      ? openAlarms.filter(item => ["major", "critical"].includes(item.severity)).map(item => `- ${item.alarmId} (${item.severity}) at ${item.siteId}: ${item.description}`)
      : ["- None"]),
    "",
    "Sample data and screening results are not engineering approval. Validate busy-hour periods, source data and radio constraints before acting."
  ];
  state.report = lines.join("\n");
  render();
  toast("Engineering report generated.");
}

nav.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button || !state.data) return;
  state.view = button.dataset.view;
  render();
});

page.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton && state.data) {
    state.view = viewButton.dataset.view;
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "refresh") void loadData({ quiet: true });
  if (button.dataset.action === "csv") exportCsv(button.dataset.kind);
  if (button.dataset.action === "geojson" && state.geojson) {
    download(`telecom-sites-${new Date().toISOString().slice(0, 10)}.geojson`, JSON.stringify(state.geojson, null, 2), "application/geo+json");
    toast(`${state.geojson.features.length} site features exported.`);
  }
  if (button.dataset.action === "report-download" && state.report) {
    download(`telecom-network-report-${new Date().toISOString().slice(0, 10)}.md`, state.report, "text/markdown;charset=utf-8");
    toast("Markdown report downloaded.");
  }
});

page.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "site-filters") {
    const rows = state.data.sites.filter(site =>
      includes(`${site.siteId} ${site.siteName}`, form.querySelector("#site-search").value) &&
      includes(site.region, form.querySelector("#site-region").value) &&
      includes(site.district, form.querySelector("#site-district").value) &&
      (!form.querySelector("#site-tech").value || site.technology.includes(form.querySelector("#site-tech").value)) &&
      (!form.querySelector("#site-status").value || site.status === form.querySelector("#site-status").value)
    );
    document.querySelector("#site-results").innerHTML = `${statusTable(rows, "sites")}<div class="table-meta"><span>${rows.length} of ${state.data.sites.length} sites</span><span>Inventory is read-only</span></div>`;
  } else if (form.id === "link-filters") {
    const siteMap = new Map(state.data.sites.map(site => [site.siteId.toLowerCase(), site]));
    const district = form.querySelector("#link-district").value;
    const rows = state.data.links.filter(link =>
      includes(link.linkId, form.querySelector("#link-search").value) &&
      includes(link.region, form.querySelector("#link-region").value) &&
      (!district || [link.siteA, link.siteB].some(id => includes(siteMap.get(id.toLowerCase())?.district, district))) &&
      (!form.querySelector("#link-status").value || link.status === form.querySelector("#link-status").value) &&
      (!form.querySelector("#link-availability").value || Number(link.availabilityPct) <= Number(form.querySelector("#link-availability").value)) &&
      (!form.querySelector("#link-capacity").value || Number(link.capacityMbps) < Number(form.querySelector("#link-capacity").value))
    );
    document.querySelector("#link-results").innerHTML = `${statusTable(rows)}<div class="table-meta"><span>${rows.length} of ${state.data.links.length} links</span><span>District filter matches either endpoint site</span></div>`;
  } else if (form.id === "capacity-form") {
    const threshold = Number(form.querySelector("#util-threshold").value);
    const region = form.querySelector("#capacity-region").value;
    document.querySelector("#capacity-results").innerHTML = capacityResults(state.data.links, threshold, region);
    const flagged = state.data.links.filter(link => includes(link.region, region) && Number(link.utilizationPct) >= threshold);
    toast(`Capacity screening complete: ${flagged.length} links flagged.`);
  } else if (form.id === "alarm-filters") {
    const rows = state.data.alarms.filter(item =>
      (!form.querySelector("#alarm-severity").value || item.severity === form.querySelector("#alarm-severity").value) &&
      (!form.querySelector("#alarm-status").value || item.status === form.querySelector("#alarm-status").value) &&
      includes(item.siteId, form.querySelector("#alarm-site").value) &&
      includes(item.linkId, form.querySelector("#alarm-link").value)
    );
    document.querySelector("#alarm-results").innerHTML = `${statusTable(rows, "alarms")}<div class="table-meta"><span>${rows.length} of ${state.data.alarms.length} alarms</span><span>Read-only fault data</span></div>`;
  } else if (form.id === "complaint-filters") {
    const district = form.querySelector("#complaint-district").value;
    const rows = state.data.complaints.filter(item =>
      (!form.querySelector("#complaint-status").value || item.status === form.querySelector("#complaint-status").value) &&
      includes(item.category, form.querySelector("#complaint-category").value) &&
      includes(item.siteId, form.querySelector("#complaint-site").value) &&
      (!district || state.data.sites.some(site => site.siteId === item.siteId && site.district === district))
    );
    document.querySelector("#complaint-results").innerHTML = `${statusTable(rows, "complaints")}<div class="table-meta"><span>${rows.length} of ${state.data.complaints.length} complaints</span></div>`;
  } else if (form.id === "performance-form") {
    if (form.querySelector("#perf-from").value === form.querySelector("#perf-to").value) {
      toast("Choose two different months to compare.", true);
      return;
    }
    state.performanceFilters = {
      from: form.querySelector("#perf-from").value,
      to: form.querySelector("#perf-to").value,
      region: form.querySelector("#perf-region").value
    };
    render();
    const params = new URLSearchParams({
      from: state.performanceFilters.from,
      to: state.performanceFilters.to,
      region: state.performanceFilters.region
    });
    history.replaceState(null, "", `?${params}`);
  } else if (form.id === "geo-filters") {
    state.geoFilters = {
      region: form.querySelector("#geo-region").value,
      district: form.querySelector("#geo-district").value
    };
    const params = new URLSearchParams({ geoRegion: state.geoFilters.region, district: state.geoFilters.district });
    history.replaceState(null, "", `?${params}`);
    render();
  } else if (form.id === "report-form") {
    generateReport(form);
  }
});

page.addEventListener("reset", event => {
  const form = event.target;
  setTimeout(() => {
    if (form.id === "site-filters" || form.id === "link-filters" || form.id === "alarm-filters" || form.id === "complaint-filters") render();
    if (form.id === "capacity-form") {
      document.querySelector("#capacity-results").innerHTML = capacityResults(state.data.links, 80, "");
    }
  }, 0);
});

document.querySelector("#refresh-button").addEventListener("click", () => void loadData({ quiet: true }));

loadData();
