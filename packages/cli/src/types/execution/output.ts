// The types of execution/output in this package.
import type { z } from 'zod';
import type { typosEntry } from '#cli/execution/output/tool-formats.ts';
import type { CheckSpec, OutputFormat } from '#cli/types/configurations.ts';

/** What the regex output parser needs per line: the format, the compiled fixable pattern and the help text. */
export type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };
export type Parsing = { spec: CheckSpec; stdout: string; text: string; root: string; cwd: string };
export type TypoEntry = z.infer<typeof typosEntry>;
