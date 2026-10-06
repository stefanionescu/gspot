import type { z } from 'zod';
import type { outputSchema } from '#cli/parsers/schema/output.ts';

import type {
    knipReportSchema,
    typosEntrySchema,
    eslintReportSchema,
    eslintDiagnosticSchema,
    markdownlintReportSchema,
} from '#cli/parsers/schema/report.ts';

/** The output table accepted by configuration and repository checks. */
export type OutputSpec = z.infer<typeof outputSchema>;

/** Native ESLint source diagnostic derived from the report schema. */
export type EslintDiagnostic = z.infer<typeof eslintDiagnosticSchema>;
export type EslintReport = z.infer<typeof eslintReportSchema>;
export type MarkdownlintEntry = z.infer<typeof markdownlintReportSchema>[number];
export type KnipReport = z.infer<typeof knipReportSchema>;
export type TypoEntry = z.infer<typeof typosEntrySchema>;

/** Output patterns and metadata owned by the parsing boundary. */
export type RegexParser = { output: OutputSpec; fixable: RegExp | undefined; help: string };
export type OutputPaths = { cwd: string; root: string };
/** Check identity, output declaration, and fixer command consumed by output parsing. */
export type ParsingCheck = { name: string; help: string; output?: OutputSpec; fix?: string[] };
export type Parsing = OutputPaths & { spec: ParsingCheck; stdout: string; text: string };

/** Manifest field mappings and public metadata for one JSON finding. */
export type JsonFindingSpec = { check: string; help: string; output: OutputSpec };
