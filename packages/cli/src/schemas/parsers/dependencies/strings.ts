import { z } from 'zod';

export const stringList = z.array(z.string()) satisfies z.ZodType<string[]>;

export const stringMap = z.record(z.string(), z.string()) satisfies z.ZodType<Record<string, string>>;
