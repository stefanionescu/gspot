import { z } from 'zod';

export const miseToolsSchema = z.object({ tools: z.record(z.string(), z.unknown()).default({}) });

export const miseTasksSchema = z.object({ tasks: z.record(z.string(), z.unknown()).default({}) });
export const miseTaskAliasSchema = z.object({ alias: z.union([z.string(), z.array(z.string())]).optional() });
