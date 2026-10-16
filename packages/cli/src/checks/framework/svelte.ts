import { z } from 'zod';
import { join } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { normalizeOutputPath } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { toolFindings } from '#cli/execution/command/output.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { writeScopeTsconfig } from '#cli/checks/language/typescript/compiler.ts';

import {
    FAILURE_LINE,
    DIAGNOSTIC_LINE,
    SVELTE_CHECK_COMMAND,
    SVELTE_TSCONFIG_FLAG,
    SVELTE_DIAGNOSTIC_TYPES,
} from '#cli/config/checks/framework/svelte.ts';

const diagnosticSchema = z.object({
    type: z.enum(SVELTE_DIAGNOSTIC_TYPES),
    filename: z.string().min(1),
    start: z.object({
        line: z.number().int().nonnegative(),
        character: z.number().int().nonnegative(),
    } satisfies SchemaShape<{ line: number; character: number }>),
    message: z.string(),
    code: (z.union([z.string(), z.number()]) satisfies z.ZodType<string | number>).optional(),
} satisfies SchemaShape<{
    type: (typeof SVELTE_DIAGNOSTIC_TYPES)[number];
    filename: string;
    start: { line: number; character: number };
    message: string;
    code?: string | number | undefined;
}>);
/**
 * Reads the machine-verbose report of svelte-check.
 * @param input the input for one scope.
 * @param stdout what svelte-check printed.
 * @returns one finding for each error and warning.
 */
function svelteFindings(input: CheckInput, stdout: string): Finding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined) throw new Error(`The svelte-check run failed: ${z.string().parse(JSON.parse(failure))}`);
    return lines.flatMap((line): Finding[] => {
        const text = DIAGNOSTIC_LINE.exec(line)?.groups?.['diagnostic'];
        if (text === undefined) return [];
        const diagnostic = diagnosticSchema.parse(JSON.parse(text));
        const rule = typeof diagnostic.code === 'number' ? `TS${String(diagnostic.code)}` : diagnostic.code;
        return [
            findingAt(
                input,
                {
                    file: joinScope(input.scope.scope.path, normalizeOutputPath(diagnostic.filename)),
                    line: diagnostic.start.line + 1,
                    column: diagnostic.start.character + 1,
                },
                rule ?? 'svelte-check',
                diagnostic.message,
            ),
        ];
    });
}
/**
 * Runs svelte-check over the scope: the compiler warnings, the accessibility warnings, and the types.
 * @param input the check input.
 * @returns one finding for each error and warning.
 */
export async function svelteCheck(input: CheckInput): Promise<Finding[]> {
    using runtime = createScratchFolder();
    const target = join(runtime.path, TOOL_FILE_DIRECTORY, input.scope.scope.path, TSCONFIG_FILE);
    const config = writeScopeTsconfig(
        {
            root: input.root,
            installedRoot: input.installedRoot,
            reads: input.reads,
            repository: { files: input.repositoryFiles, scopes: input.scopeEntries },
            settingsFile: input.settingsFile,
        },
        input.scope,
        target,
    );
    const command = [...SVELTE_CHECK_COMMAND, SVELTE_TSCONFIG_FLAG, config];
    const result = await runCheckTool(input, command, { cwd: join(input.root, input.scope.scope.path) });
    const findings = svelteFindings(input, result.stdout);
    return toolFindings(result, findings, 'svelte-check');
}
