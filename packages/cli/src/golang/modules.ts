// The module checks of a Go scope: a tidy go.mod, and the vulnerabilities the code reaches.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const MODULE_FILE = 'go.mod';
const COMMAND_TIMEOUT_MS = 900_000;
const FOUND_EXIT = 3;
// govulncheck opens each vulnerability the code reaches with its number and its id, and names the fix two lines on.
const VULNERABILITY = /^Vulnerability #\d+: (?<id>GO-[\d-]+)$/u;
const FIXED_IN = /^\s+Fixed in: (?<fix>\S+)$/u;
const FOUND_IN = /^\s+Found in: (?<module>\S+)$/u;

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

function lastLine(text: string): string {
    return text.trim().split('\n').at(-1) ?? '';
}

function reached(input: EngineInput, output: string): Finding[] {
    const lines = output.split('\n');
    return lines.flatMap((line, index): Finding[] => {
        const id = VULNERABILITY.exec(line)?.groups?.['id'];
        if (id === undefined) return [];
        const block = lines.slice(
            index + 1,
            lines.findIndex((next, at) => at > index && next.trim() === ''),
        );
        const found = block
            .map((entry) => FOUND_IN.exec(entry)?.groups?.['module'])
            .find((entry) => entry !== undefined);
        const fix = block.map((entry) => FIXED_IN.exec(entry)?.groups?.['fix']).find((entry) => entry !== undefined);
        const remedy = fix === undefined ? 'No fixed version exists yet.' : `Fixed in ${fix}.`;
        const text = `${found ?? 'A module'} holds ${id}, and the code reaches it. ${remedy}`;
        return [
            {
                check: input.spec.id,
                file: inScope(input, MODULE_FILE),
                line: 1,
                rule: id,
                message: text,
                fixable: false,
            },
        ];
    });
}

/**
 * One finding when go mod tidy has something to change in the module of the scope.
 * @param input the engine input
 * @returns the findings
 */
export async function goModTidy(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, MODULE_FILE))) return [];
    const result = await run(['go', 'mod', 'tidy', '-diff'], { cwd, timeoutMs: COMMAND_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError('The go command is not installed.');
    if (result.code === 0) return [];
    const changed = result.stdout.split('\n').filter((line) => line.startsWith('+++ ') || line.startsWith('--- '));
    if (changed.length === 0) throw new Error(`The go mod tidy command failed: ${lastLine(result.stderr)}`);
    const text = 'go mod tidy changes this module: a requirement nothing imports, or an import with no requirement.';
    return [
        {
            check: input.spec.id,
            file: inScope(input, MODULE_FILE),
            line: 1,
            rule: 'untidy',
            message: text,
            fixable: false,
        },
    ];
}

/**
 * One finding for each known vulnerability the code of the scope reaches.
 * @param input the engine input
 * @returns the findings
 */
export async function goVulnerabilities(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, MODULE_FILE))) return [];
    const result = await run(['govulncheck', './...'], { cwd, timeoutMs: COMMAND_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError('The govulncheck command is not installed.');
    if (result.code === 0) return [];
    const found = reached(input, result.stdout);
    if (result.code !== FOUND_EXIT || found.length === 0)
        throw new Error(`The govulncheck command failed: ${lastLine([result.stdout, result.stderr].join('\n'))}`);
    return found;
}
