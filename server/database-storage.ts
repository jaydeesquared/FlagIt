import { db } from "./db";
import {
  recordings,
  flags,
  categories,
  type InsertRecording,
  type UpdateRecordingRequest,
  type InsertFlag,
  type UpdateFlagRequest,
  type Recording,
  type Flag,
  type RecordingWithFlags,
  type Category,
  type InsertCategory,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { IStorage } from "./storage-interface";

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db!.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db!.insert(categories).values(category).returning();
    return newCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db!.delete(categories).where(eq(categories.id, id));
  }

  async getRecordings(): Promise<Recording[]> {
    return await db!.select().from(recordings).orderBy(desc(recordings.createdAt));
  }

  async getRecording(id: number): Promise<RecordingWithFlags | undefined> {
    const recording = await db!.select().from(recordings).where(eq(recordings.id, id));
    if (recording.length === 0) return undefined;

    const recordingFlags = await db!.select().from(flags).where(eq(flags.recordingId, id));

    return { ...recording[0], flags: recordingFlags };
  }

  async createRecording(recording: InsertRecording): Promise<Recording> {
    const [newRecording] = await db!.insert(recordings).values(recording).returning();
    return newRecording;
  }

  async updateRecording(id: number, updates: UpdateRecordingRequest): Promise<Recording> {
    const [updated] = await db!
      .update(recordings)
      .set(updates)
      .where(eq(recordings.id, id))
      .returning();
    return updated;
  }

  async deleteRecording(id: number): Promise<void> {
    await db!.delete(flags).where(eq(flags.recordingId, id));
    await db!.delete(recordings).where(eq(recordings.id, id));
  }

  async createFlag(flag: InsertFlag): Promise<Flag> {
    const [newFlag] = await db!.insert(flags).values(flag).returning();
    return newFlag;
  }

  async updateFlag(id: number, updates: UpdateFlagRequest): Promise<Flag> {
    const [updated] = await db!.update(flags).set(updates).where(eq(flags.id, id)).returning();
    return updated;
  }

  async deleteFlag(id: number): Promise<void> {
    await db!.delete(flags).where(eq(flags.id, id));
  }

  async getFlagsForRecording(recordingId: number): Promise<Flag[]> {
    return await db!.select().from(flags).where(eq(flags.recordingId, recordingId));
  }
}
