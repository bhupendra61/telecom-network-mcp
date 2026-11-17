import type { Alarm, Complaint, MicrowaveLink, MonthlyPerformance, Site } from "./types.js";

export const sampleSites: Site[] = [
  { siteId: "KTM-001", siteName: "Kathmandu Central", district: "Kathmandu", region: "Bagmati", technology: ["4G", "5G"], latitude: 27.7172, longitude: 85.3240, status: "active" },
  { siteId: "KTM-002", siteName: "Lalitpur South", district: "Lalitpur", region: "Bagmati", technology: ["4G"], latitude: 27.6588, longitude: 85.3247, status: "active" },
  { siteId: "PKR-001", siteName: "Pokhara Main", district: "Kaski", region: "Gandaki", technology: ["4G", "5G"], latitude: 28.2096, longitude: 83.9856, status: "active" },
  { siteId: "JNK-001", siteName: "Janakpur East", district: "Dhanusha", region: "Madhesh", technology: ["2G", "4G"], latitude: 26.7288, longitude: 85.9263, status: "maintenance" },
  { siteId: "BRT-001", siteName: "Biratnagar North", district: "Morang", region: "Koshi", latitude: 26.4525, longitude: 87.2718, technology: ["4G"], status: "active" }
];

export const sampleLinks: MicrowaveLink[] = [
  { linkId: "MW-1001", siteA: "KTM-001", siteB: "KTM-002", region: "Bagmati", frequencyGHz: 18, capacityMbps: 1000, utilizationPct: 72, availabilityPct: 99.95, status: "up" },
  { linkId: "MW-1002", siteA: "KTM-001", siteB: "PKR-001", region: "Gandaki", frequencyGHz: 23, capacityMbps: 500, utilizationPct: 91, availabilityPct: 99.70, status: "degraded" },
  { linkId: "MW-1003", siteA: "JNK-001", siteB: "BRT-001", region: "Madhesh/Koshi", frequencyGHz: 13, capacityMbps: 250, utilizationPct: 44, availabilityPct: 98.90, status: "up" },
  { linkId: "MW-1004", siteA: "PKR-001", siteB: "KTM-002", region: "Gandaki/Bagmati", frequencyGHz: 18, capacityMbps: 750, utilizationPct: 35, availabilityPct: 99.99, status: "up" }
];

export const sampleAlarms: Alarm[] = [
  { alarmId: "AL-9001", siteId: "PKR-001", linkId: "MW-1002", severity: "major", description: "Microwave link utilization above 90%", openedAt: "2026-11-16T08:20:00+05:45", status: "open" },
  { alarmId: "AL-9002", siteId: "JNK-001", severity: "minor", description: "Site under scheduled maintenance", openedAt: "2026-11-16T06:00:00+05:45", status: "open" },
  { alarmId: "AL-9003", siteId: "KTM-001", severity: "warning", description: "Routine temperature threshold warning", openedAt: "2026-11-15T14:10:00+05:45", status: "cleared" }
];

export const sampleComplaints: Complaint[] = [
  { complaintId: "CP-3001", siteId: "KTM-001", category: "slow data", description: "Low evening data throughput reported", openedAt: "2026-11-16T17:30:00+05:45", status: "open" },
  { complaintId: "CP-3002", siteId: "KTM-001", category: "coverage", description: "Intermittent indoor coverage", openedAt: "2026-11-15T11:15:00+05:45", status: "open" },
  { complaintId: "CP-3003", siteId: "KTM-001", category: "voice quality", description: "Call quality issue reported", openedAt: "2026-11-14T09:00:00+05:45", status: "resolved" },
  { complaintId: "CP-3004", siteId: "PKR-001", category: "slow data", description: "Reduced throughput near the site", openedAt: "2026-11-16T13:40:00+05:45", status: "open" },
  { complaintId: "CP-3005", siteId: "JNK-001", category: "coverage", description: "Coverage interruption during maintenance", openedAt: "2026-11-16T07:10:00+05:45", status: "open" }
];

export const sampleMonthlyPerformance: MonthlyPerformance[] = [
  { month: "2026-09", region: "Bagmati", trafficMbps: 1120, throughputMbps: 1040, utilizationPct: 67, availabilityPct: 99.94 },
  { month: "2026-09", region: "Gandaki", trafficMbps: 760, throughputMbps: 710, utilizationPct: 63, availabilityPct: 99.82 },
  { month: "2026-10", region: "Bagmati", trafficMbps: 1260, throughputMbps: 1150, utilizationPct: 74, availabilityPct: 99.91 },
  { month: "2026-10", region: "Gandaki", trafficMbps: 830, throughputMbps: 760, utilizationPct: 69, availabilityPct: 99.70 }
];
