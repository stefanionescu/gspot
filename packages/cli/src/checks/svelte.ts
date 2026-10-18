import { z } from 'zod';
import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { parseReport } from '#cli/runs/output/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { normalizeOutputPath } from '#cli/system/paths.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { TOOL_FILES_FOLDER } from '#cli/config/system/locations.ts';
import { writeScopeTsconfig } from '#cli/checks/typescript/compiler.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';

import {
    FAILURE_LINE,
    FINDING_LINE,
    SVELTE_SEVERITIES,
    SVELTE_CHECK_COMMAND,
    SVELTE_TSCONFIG_FLAG,
} from '#cli/config/checks/framework/svelte.ts';

const findingSchema = z.object({
    type: z.enum(SVELTE_SEVERITIES),
    filename: z.string().min(1),
    start: z.object({
        line: z.number().int().nonnegative(),
        character: z.number().int().nonnegative(),
    } satisfies SchemaShape<{ line: number; character: number }>),
    message: z.string(),
    code: (z.union([z.string(), z.number()]) satisfies z.ZodType<string | number>).optional(),
} satisfies SchemaShape<{
    type: (typeof SVELTE_SEVERITIES)[number];
    filename: string;
    start: { line: number; character: number };
    message: string;
    code?: string | number | undefined;
}>);
/**
 * Parses the machine-verbose output of svelte-check.
 * @param input the scope that ran the check.
 * @param stdout what svelte-check printed.
 * @returns one finding for each error and warning.
 */
function parseSvelteCheckFindings(input: CheckInput, stdout: string): Finding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined)
        throw new Error(`The svelte-check run failed: ${parseReport('svelte-check', failure, z.string())}`);
    return lines.flatMap((line): Finding[] => {
        const text = FINDING_LINE.exec(line)?.groups?.['message'];
        if (text === undefined) return [];
        const reported = parseReport('svelte-check', text, findingSchema);
        const rule = typeof reported.code === 'number' ? `TS${String(reported.code)}` : reported.code;
        return [
            buildFinding(
                input,
                {
                    file: joinScope(input.selection.scope.path, normalizeOutputPath(reported.filename)),
                    line: reported.start.line + 1,
                    column: reported.start.character + 1,
                },
                rule ?? 'svelte-check',
                reported.message,
            ),
        ];
    });
}

/**
 * Runs svelte-check on the scope for compiler warnings, accessibility warnings, and type errors.
 * @param input the scope to check.
 * @returns one finding for each error and warning.
 */
export async function runSvelteCheck(input: CheckInput): Promise<Finding[]> {
    using runtime = createScratchFolder();
    const target = join(runtime.path, TOOL_FILES_FOLDER, input.selection.scope.path, TSCONFIG_FILE);
    const tsconfigPath = writeScopeTsconfig(
        {
            root: input.root,
            installedRoot: input.installedRoot,
            reads: input.reads,
            repository: { files: input.repositoryFiles, scopes: input.scopes },
            settingsFile: input.settingsFile,
        },
        input.selection,
        target,
    );
    const command = [...SVELTE_CHECK_COMMAND, SVELTE_TSCONFIG_FLAG, tsconfigPath];
    const result = await runCheckTool(input, command, { cwd: join(input.root, input.selection.scope.path) });
    const findings = parseSvelteCheckFindings(input, result.stdout);
    return assertToolFindings(result, findings, 'svelte-check');
}
