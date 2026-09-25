import { join } from 'node:path';
import { z } from 'zod';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { selectedTarget, targetInScope } from '#cli/configurations/targets.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';

// svelte-check writes each diagnostic on a line of its own: a timestamp, then the diagnostic as JSON.
const DIAGNOSTIC_LINE = /^\d+ (?<diagnostic>\{.*\})$/u;
const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;

const diagnosticSchema = z.object({
    type: z.enum(['ERROR', 'WARNING']),
    filename: z.string().min(1),
    start: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
});

/**
 * Reads the machine-verbose report of svelte-check.
 * @param check the check name
 * @param scope the scope path, empty for the root
 * @param stdout what svelte-check printed
 * @returns one finding for each error and warning
 */
export function svelteFindings(check: string, scope: string, stdout: string): Finding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined) throw new Error(`svelte-check failed: ${z.string().parse(JSON.parse(failure))}`);
    return lines.flatMap((line): Finding[] => {
        const text = DIAGNOSTIC_LINE.exec(line)?.groups?.['diagnostic'];
        if (text === undefined) return [];
        const diagnostic = diagnosticSchema.parse(JSON.parse(text));
        const rule = typeof diagnostic.code === 'number' ? `TS${String(diagnostic.code)}` : diagnostic.code;
        return [
            {
                check,
                file: scope === '' ? diagnostic.filename : `${scope}/${diagnostic.filename}`,
                line: diagnostic.start.line + 1,
                column: diagnostic.start.character + 1,
                ...(rule === undefined ? {} : { rule }),
                message: diagnostic.message,
                fixable: false,
            },
        ];
    });
}

/**
 * Runs svelte-check over the scope: the compiler warnings, the accessibility warnings, and the types.
 * @param input the engine input
 * @returns one finding for each error and warning
 */
export async function svelteCheck(input: EngineInput): Promise<Finding[]> {
    // A scope with a generated TypeScript configuration is checked with its strict compiler options.
    const tsconfig = selectedTarget(input.selection.selected, 'tsconfig');
    const command = [
        'svelte-check',
        '--workspace',
        '.',
        '--output',
        'machine-verbose',
        '--fail-on-warnings',
        ...(tsconfig === undefined ? [] : ['--tsconfig', join(input.root, targetInScope(input.scope, tsconfig))]),
    ];
    const result = await runCheckCommand(input, command, { cwd: input.scopeRoot });
    const findings = svelteFindings(input.spec.name, input.scope, result.stdout);
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`svelte-check exited ${String(result.code)}: ${`${result.stdout}\n${result.stderr}`.trim()}`);
    return findings;
}
