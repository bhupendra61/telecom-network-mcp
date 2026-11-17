export type Site = {
  siteId: string;
  siteName: string;
  district: string;
  region: string;
  technology: string[];
  latitude?: number;
  longitude?: number;
  status: "active" | "inactive" | "maintenance";
};

export type MicrowaveLink = {
  linkId: string;
  siteA: string;
  siteB: string;
  region: string;
  frequencyGHz: number;
  capacityMbps: number;
  utilizationPct: number;
  availabilityPct: number;
  status: "up" | "down" | "degraded";
};

export type Alarm = {
  alarmId: string;
  siteId: string;
  linkId?: string;
  severity: "critical" | "major" | "minor" | "warning";
  description: string;
  openedAt: string;
  status: "open" | "cleared";
};

export type Complaint = {
  complaintId: string;
  siteId: string;
  category: string;
  description: string;
  openedAt: string;
  status: "open" | "resolved";
};

export type MonthlyPerformance = {
  month: string;
  region: string;
  trafficMbps: number;
  throughputMbps: number;
  utilizationPct: number;
  availabilityPct: number;
};
