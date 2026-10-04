import type { z } from 'zod';
import type { cloneReportSchema } from '#cli/parsers/schema/duplication.ts';

/** The validated native duplication report consumed by finding generation. */
export type CloneReport = z.infer<typeof cloneReportSchema>;

/** The owned files and percentage ceiling for turning clone measurements into findings. */
export type CloneScope = { check: string; root: string; ceiling: number; owned: Set<string> };
