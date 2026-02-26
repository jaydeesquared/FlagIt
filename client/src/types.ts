import { z } from "zod";

// ============================================
// TYPE DEFINITIONS
// ============================================

export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
});

export const recordingSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  categoryId: z.number().nullable(),
  duration: z.number(),
  notes: z.string(),
  createdAt: z.date(),
});

export const flagSchema = z.object({
  id: z.number(),
  recordingId: z.number(),
  timestamp: z.number(),
  color: z.string(),
  description: z.string(),
});

// Insert schemas (for creating new records)
export const insertCategorySchema = categorySchema.omit({ id: true });
export const insertRecordingSchema = recordingSchema.omit({ id: true, createdAt: true });
export const insertFlagSchema = flagSchema.omit({ id: true });

// Export types
export type Category = z.infer<typeof categorySchema>;
export type Recording = z.infer<typeof recordingSchema>;
export type Flag = z.infer<typeof flagSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type InsertFlag = z.infer<typeof insertFlagSchema>;

// Response types
export type RecordingWithFlags = Recording & { flags: Flag[] };
