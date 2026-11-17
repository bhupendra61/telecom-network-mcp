import { MongoClient, type Db, type Document } from "mongodb";
import { sampleAlarms, sampleComplaints, sampleLinks, sampleMonthlyPerformance, sampleSites } from "./sample-data.js";
import type { Alarm, Complaint, MicrowaveLink, MonthlyPerformance, Site } from "./types.js";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI is empty: using built-in sample data.");
    return;
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "telecom_network");
  console.error(`Connected to MongoDB database: ${db.databaseName}`);
}

async function readCollection<T>(name: string, sample: T[]): Promise<T[]> {
  if (!db) return sample;
  const records = await db.collection<Document>(name).find({}).limit(5000).toArray();
  return records as unknown as T[];
}

export async function getSites(): Promise<Site[]> {
  return readCollection<Site>("sites", sampleSites);
}
export async function getLinks(): Promise<MicrowaveLink[]> {
  return readCollection<MicrowaveLink>("microwaveLinks", sampleLinks);
}
export async function getAlarms(): Promise<Alarm[]> {
  return readCollection<Alarm>("alarms", sampleAlarms);
}
export async function getComplaints(): Promise<Complaint[]> {
  return readCollection<Complaint>("complaints", sampleComplaints);
}
export async function getMonthlyPerformance(): Promise<MonthlyPerformance[]> {
  return readCollection<MonthlyPerformance>("monthlyPerformance", sampleMonthlyPerformance);
}

export async function closeDatabase(): Promise<void> {
  if (client) await client.close();
}
