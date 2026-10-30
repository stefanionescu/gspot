import type { z } from 'zod';
import type { Finding } from '#cli/types/runs/check.ts';
import type { CHECK_RUNS } from '#cli/config/configurations/names.ts';
import type { outputSchema } from '#cli/schemas/configurations/output.ts';

export type ToolOutput = OutputPaths & {
    check: string;
    help: string;
    stdout: string;
    text: string;
    output: CheckOutput;
};

export type CheckOutput = z.output<typeof outputSchema>;

export type OutputPaths = { cwd: string; root: string };

export type ParsingCheck = {
    id: string;
    help: string;
    runs: (typeof CHECK_RUNS)[number];
    output: CheckOutput;
    fix?: string[] | undefined;
};

export type OutputParser = {
    parse: (output: ToolOutput) => Finding[];
    namesFiles: (output: CheckOutput) => boolean;
};
