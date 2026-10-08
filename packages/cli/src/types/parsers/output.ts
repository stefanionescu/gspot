import type { z } from 'zod';
import type { Defined } from '#cli/types/platform/runtime.ts';

import type {
    outputSchema,
    findingSchema,
    knipReportSchema,
    typosEntrySchema,
    markdownlintReportSchema,
} from '#cli/parsers/schema/contracts.ts';

/** The output table accepted by configuration and command checks. */
export type OutputSpec = z.infer<typeof outputSchema>;

export type MarkdownlintEntry = z.infer<typeof markdownlintReportSchema>[number];
export type KnipReport = z.infer<typeof knipReportSchema>;
export type TypoEntry = z.infer<typeof typosEntrySchema>;

/** Output patterns and metadata owned by the parsing boundary. */
export type RegexParser = { output: OutputSpec; fixable: RegExp | undefined; help: string };
export type OutputPaths = { cwd: string; root: string };
/** Check identity, output declaration, and fixer command consumed by output parsing. */
export type ParsingCheck = { name: string; help: string; output?: OutputSpec; fix?: string[] };
export type Parsing = OutputPaths & { check: ParsingCheck; stdout: string; text: string };

/** Manifest field mappings and public metadata for one JSON finding. */
export type JsonFindingSpec = { check: string; help: string; output: OutputSpec };

export type Finding = Defined<z.infer<typeof findingSchema>>;

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

/** A Vale diagnostic normalized to a repository path and one-based source location. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

/** One format's parser, source-file checks and protection of captured output. */
export type OutputDescriptor = {
    read: (parsing: Parsing, output: OutputSpec) => Finding[];
    namesFiles: (output: OutputSpec) => boolean;
    verifyFiles: boolean;
    withholdOutput: boolean;
};
