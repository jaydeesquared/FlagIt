import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: varchar("color", { length: 20 }).default("gray").notNull(),
});

export const recordings = pgTable("recordings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").default("Recordings").notNull(),  // Changed from "Uncategorized" to "Recordings"
  categoryId: integer("category_id").references(() => categories.id),
  duration: integer("duration").default(0).notNull(), // in milliseconds
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const flags = pgTable("flags", {
  id: serial("id").primaryKey(),
  recordingId: integer("recording_id").notNull(), // Foreign key to recordings
  timestamp: integer("timestamp").notNull(), // in milliseconds relative to start
  color: varchar("color", { length: 20 }).default("red").notNull(), // 'red', 'green', 'blue', etc.
  description: text("description").default("").notNull(),
});

// === RELATIONS ===
export const recordingsRelations = relations(recordings, ({ many }) => ({
  flags: many(flags),
}));

export const flagsRelations = relations(flags, ({ one }) => ({
  recording: one(recordings, {
    fields: [flags.recordingId],
    references: [recordings.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertRecordingSchema = createInsertSchema(recordings).omit({ id: true, createdAt: true });
export const insertFlagSchema = createInsertSchema(flags).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = z.infer<typeof insertRecordingSchema>;

export type Flag = typeof flags.$inferSelect;
export type InsertFlag = z.infer<typeof insertFlagSchema>;

// Request types
export type CreateRecordingRequest = InsertRecording;
export type UpdateRecordingRequest = Partial<InsertRecording>;
export type CreateFlagRequest = InsertFlag;
export type UpdateFlagRequest = Partial<InsertFlag>;

// Response types
export type RecordingWithFlags = Recording & { flags: Flag[] };
export type RecordingResponse = Recording;
export type FlagResponse = Flag;
