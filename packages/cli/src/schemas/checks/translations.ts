import { z } from 'zod';

export const messagesSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;
