import type { z } from 'zod';
import type { outputSchema } from '#cli/parsers/schema/output.ts';

import type {
    typosEntrySchema,
    eslintReportSchema,
    eslintDiagnosticSchema,
    markdownlintReportSchema,
} from '#cli/parsers/schema/report.ts';

/** The output fields accepted by both configuration and repository checks. */
export type OutputFormat = z.infer<typeof outputSchema>;

/** Native ESLint source diagnostic derived from the report schema. */
export type EslintDiagnostic = z.infer<typeof eslintDiagnosticSchema>;
export type EslintReport = z.infer<typeof eslintReportSchema>;
export type MarkdownlintEntry = z.infer<typeof markdownlintReportSchema>[number];
export type TypoEntry = z.infer<typeof typosEntrySchema>;

/** Output patterns and metadata owned by the parsing boundary. */
export type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };
export type OutputPaths = { cwd: string; root: string };
export type OutputSpec = { name: string; help: string; output?: OutputFormat; fix?: string[] };
export type Parsing = OutputPaths & { spec: OutputSpec; stdout: string; text: string };

/** Manifest field mappings and public metadata for one JSON finding. */
export type JsonFindingSpec = { check: string; help: string; output: OutputFormat };
