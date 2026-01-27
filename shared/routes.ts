
import { z } from 'zod';
import { insertQuestionSchema, identifySchema, submitAnswerSchema, heartbeatSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  forbidden: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // Public / Participant Routes
  identify: {
    method: 'POST' as const,
    path: '/api/identify',
    input: identifySchema,
    responses: {
      200: z.object({ 
        token: z.string(),
        participant: z.object({ id: z.number(), name: z.string() }) 
      }),
      400: errorSchemas.validation,
      403: errorSchemas.forbidden, // Banned or name taken by other device
    },
  },
  
  getDailyQuestion: {
    method: 'GET' as const,
    path: '/api/question/daily',
    responses: {
      200: z.object({
        id: z.number(),
        content: z.string(),
        options: z.array(z.string()), // Or array of objects, depending on implementation
        quizDate: z.string(),
        order: z.number(),
      }).nullable(), // Null if no question for today or already submitted
      403: errorSchemas.forbidden, // Not identified
    },
  },

  submitAnswer: {
    method: 'POST' as const,
    path: '/api/submit',
    input: submitAnswerSchema,
    responses: {
      200: z.object({
        message: z.string(),
        status: z.string(), // "Answer recorded successfully"
      }),
      400: errorSchemas.validation,
      403: errorSchemas.forbidden,
    },
  },

  heartbeat: {
    method: 'POST' as const,
    path: '/api/heartbeat',
    input: heartbeatSchema,
    responses: {
      200: z.object({ status: z.string() }),
    },
  },

  // Admin Routes
  adminLogin: {
    method: 'POST' as const,
    path: '/api/admin/login',
    input: z.object({ username: z.string(), password: z.string() }),
    responses: {
      200: z.object({ message: z.string() }),
      401: errorSchemas.unauthorized,
    },
  },
  
  adminStats: {
    method: 'GET' as const,
    path: '/api/admin/stats',
    responses: {
      200: z.object({
        totalParticipants: z.number(),
        totalSubmissionsToday: z.number(),
        activeQuestions: z.number(),
      }),
      401: errorSchemas.unauthorized,
    },
  },

  adminQuestions: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/questions',
      responses: {
        200: z.array(z.custom<any>()), // Type as needed
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/admin/questions',
      input: insertQuestionSchema,
      responses: {
        201: z.custom<any>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/admin/questions/:id',
      input: insertQuestionSchema.partial(),
      responses: {
        200: z.custom<any>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/admin/questions/:id',
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      },
    }
  },

  adminResults: {
    method: 'GET' as const,
    path: '/api/admin/results',
    input: z.object({ 
      date: z.string().optional(),
      type: z.enum(['daily', 'monthly']).default('daily') 
    }).optional(),
    responses: {
      200: z.array(z.object({
        rank: z.number(),
        participantName: z.string(),
        totalScore: z.number(),
        correctCount: z.number(),
        avgAnswerOrder: z.number(),
      })),
      401: errorSchemas.unauthorized,
    },
  },

  adminReset: {
    method: 'POST' as const,
    path: '/api/admin/reset',
    responses: {
      200: z.object({ message: z.string(), newResetId: z.number() }),
      401: errorSchemas.unauthorized,
    },
  },
  
  adminExport: {
    method: 'GET' as const,
    path: '/api/admin/export',
    // Returns binary file (blob)
    responses: {
      200: z.any(),
      401: errorSchemas.unauthorized,
    },
  }
};

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
