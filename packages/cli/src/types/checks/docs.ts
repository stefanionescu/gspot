// The types of checks/docs in this package.
import type { z } from 'zod';
import type { cloneReportSchema } from '#cli/checks/docs/copied-blocks.ts';

export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };
export type ProseLine = { number: number; line: string };
/** The validated native duplication report consumed by finding generation. */
export type CloneReport = z.infer<typeof cloneReportSchema>;
export type FencedBlock = { line: number; language: string; body: string };
export type ShapeProblem = [number, string, string];
