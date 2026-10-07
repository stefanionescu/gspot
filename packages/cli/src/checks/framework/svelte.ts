import { join } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { diagnosticSchema, svelteFailureSchema } from '#cli/parsers/schema/svelte.ts';
import { FAILURE_LINE, DIAGNOSTIC_LINE } from '#cli/config/checks/framework/svelte.ts';
import { targetInScope, configurationName } from '#cli/configurations/declarations.ts';

/**
 * Reads the machine-verbose report of svelte-check.
 * @param check the check ID
 * @param scope the scope path, empty for the root
 * @param stdout what svelte-check printed
 * @returns one finding for each error and warning
 */
export function svelteFindings(check: string, scope: string, stdout: string): Finding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined)
        throw new Error(`The svelte-check run failed: ${svelteFailureSchema.parse(JSON.parse(failure))}`);
    return lines.flatMap((line): Finding[] => {
        const text = DIAGNOSTIC_LINE.exec(line)?.groups?.['diagnostic'];
        if (text === undefined) return [];
        const diagnostic = diagnosticSchema.parse(JSON.parse(text));
        const rule = typeof diagnostic.code === 'number' ? `TS${String(diagnostic.code)}` : diagnostic.code;
        return [
            {
                check,
                file: scope === '' ? toPosix(diagnostic.filename) : `${scope}/${toPosix(diagnostic.filename)}`,
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
 * @param input the check input
 * @returns one finding for each error and warning
 */
export async function svelteCheck(input: CheckInput): Promise<Finding[]> {
    // A scope with a generated TypeScript configuration is checked with its strict compiler options.
    const tsconfig = input.selection.selected
        .flatMap((manifest) => manifest.configs)
        .find((config) => !config.fragment && configurationName(config.target) === 'tsconfig');
    const command = [
        'svelte-check',
        '--workspace',
        '.',
        '--output',
        'machine-verbose',
        '--fail-on-warnings',
        ...(tsconfig === undefined ? [] : ['--tsconfig', join(input.root, targetInScope(input.scope, tsconfig))]),
    ];
    const result = await runCheckTool(input, command, { cwd: input.scopeRoot });
    const findings = svelteFindings(input.check.name, input.scope, result.stdout);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`The svelte-check run exited ${String(result.code)}: ${output}`);
    return findings;
}
