import { join } from 'node:path';
import { z } from 'zod';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { configurationName, targetInScope } from '#cli/configurations/targets.ts';
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

function diagnosticFindings(input: EngineInput, line: string): Finding[] {
    const text = DIAGNOSTIC_LINE.exec(line)?.groups?.['diagnostic'];
    if (text === undefined) return [];
    const diagnostic = diagnosticSchema.parse(JSON.parse(text));
    const rule = typeof diagnostic.code === 'number' ? `TS${String(diagnostic.code)}` : diagnostic.code;
    return [
        {
            check: input.spec.name,
            file: input.scope === '' ? diagnostic.filename : `${input.scope}/${diagnostic.filename}`,
            line: diagnostic.start.line + 1,
            column: diagnostic.start.character + 1,
            ...(rule === undefined ? {} : { rule }),
            message: diagnostic.message,
            fixable: false,
        },
    ];
}

/**
 * Runs svelte-check over the scope: the compiler warnings, the accessibility warnings, and the types.
 * @param input the engine input
 * @returns one finding for each error and warning
 */
export async function svelteCheck(input: EngineInput): Promise<Finding[]> {
    // A scope that selects typescript is checked with the strict compiler options gspot generates for it.
    const tsconfig = input.view.configurations.includes('typescript')
        ? input.manifests
              .get('typescript')
              ?.configs.find((config) => !config.fragment && configurationName(config.target) === 'tsconfig')
        : undefined;
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
    const lines = result.stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((message) => message !== undefined);
    if (failure !== undefined) throw new Error(`svelte-check failed: ${z.string().parse(JSON.parse(failure))}`);
    const findings = lines.flatMap((line) => diagnosticFindings(input, line));
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`svelte-check exited ${String(result.code)}: ${`${result.stdout}\n${result.stderr}`.trim()}`);
    return findings;
}
