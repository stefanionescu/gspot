import { z } from 'zod';

export const stringList = z.string().array() satisfies z.ZodType<string[]>;

export const stringMap = z.record(z.string(), z.string()) satisfies z.ZodType<Record<string, string>>;
