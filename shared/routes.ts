import { z } from 'zod';
import { insertRecordingSchema, insertFlagSchema, recordings, flags } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  recordings: {
    list: {
      method: 'GET' as const,
      path: '/api/recordings',
      responses: {
        200: z.array(z.custom<typeof recordings.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/recordings/:id',
      responses: {
        200: z.custom<typeof recordings.$inferSelect & { flags: typeof flags.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/recordings',
      input: insertRecordingSchema,
      responses: {
        201: z.custom<typeof recordings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/recordings/:id',
      input: insertRecordingSchema.partial(),
      responses: {
        200: z.custom<typeof recordings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/recordings/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof recordings.$inferSelect>()), // Using recordings select type as proxy for schema
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: z.object({ name: z.string(), color: z.string().optional() }),
      responses: {
        201: z.any(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/categories/:id',
      responses: {
        204: z.void(),
      },
    },
  },
  flags: {
    create: {
      method: 'POST' as const,
      path: '/api/flags',
      input: insertFlagSchema,
      responses: {
        201: z.custom<typeof flags.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/flags/:id',
      input: insertFlagSchema.partial(),
      responses: {
        200: z.custom<typeof flags.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/flags/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE HELPERS
// ============================================
export type RecordingInput = z.infer<typeof api.recordings.create.input>;
export type FlagInput = z.infer<typeof api.flags.create.input>;
