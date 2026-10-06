import type { z } from 'zod';
import type { semgrepReportSchema } from '#cli/parsers/schema/semgrep.ts';

/** Rule matches and scanner diagnostics emitted by native Semgrep. */
export type SemgrepReport = z.infer<typeof semgrepReportSchema>;
