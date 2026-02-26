import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

async function seedDatabase() {
  // No seeding - app should start completely empty for new users
  // All data will be created by user actions only
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Recordings API
  app.get(api.recordings.list.path, async (req, res) => {
    const recordings = await storage.getRecordings();
    res.json(recordings);
  });

  app.get(api.recordings.get.path, async (req, res) => {
    const recording = await storage.getRecording(Number(req.params.id));
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }
    res.json(recording);
  });

  app.post(api.recordings.create.path, async (req, res) => {
    try {
      const input = api.recordings.create.input.parse(req.body);
      const recording = await storage.createRecording(input);
      res.status(201).json(recording);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.recordings.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.recordings.update.input.parse(req.body);
      const updated = await storage.updateRecording(id, input);
      if (!updated) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.recordings.delete.path, async (req, res) => {
    await storage.deleteRecording(Number(req.params.id));
    res.status(204).send();
  });

  // Categories API
  app.get(api.categories.list.path, async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post(api.categories.create.path, async (req, res) => {
    const cat = await storage.createCategory(req.body);
    res.status(201).json(cat);
  });

  app.delete(api.categories.delete.path, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  // Flags API
  app.post(api.flags.create.path, async (req, res) => {
    try {
      const input = api.flags.create.input.parse(req.body);
      const flag = await storage.createFlag(input);
      res.status(201).json(flag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.flags.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.flags.update.input.parse(req.body);
      const updated = await storage.updateFlag(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.flags.delete.path, async (req, res) => {
    await storage.deleteFlag(Number(req.params.id));
    res.status(204).send();
  });

  // Initialize seed data
  seedDatabase().catch(console.error);

  return httpServer;
}
