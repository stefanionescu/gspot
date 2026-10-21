import { z } from 'zod';

export const textSchema = z.string() satisfies z.ZodType<string>;
export const pathsSchema = z.array(z.string()) satisfies z.ZodType<string[]>;
export const fieldsSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;
