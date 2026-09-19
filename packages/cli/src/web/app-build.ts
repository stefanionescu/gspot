// The Next.js checks that run the framework: the type check after the framework wrote its types, and the build.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { stripVTControlCharacters } from 'node:util';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const TYPES_TIMEOUT_MS = 300_000;
const BUILD_TIMEOUT_MS = 1_800_000;
const SHOWN_LINES = 3;
const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<column>\d+)\): error (?<rule>TS\d+): (?<text>.*)$/u;
// A Next.js before 15.5 has no typegen command and reads the word as a project folder.
const NO_TYPEGEN = ['Invalid project directory', 'unknown command'];

function located(input: EngineInput, name: string): string {
    const binary = locateTool(join(input.root, input.scope), name) ?? locateTool(input.root, name);
    if (binary === undefined) throw new Error(`The ${name} command is not installed.`);
    return binary;
}

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'];

// The framework says what went wrong in one marked line, with the detail on the line below, above a long trace.
function lastLines(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + 2);
    return shown.join(' ').trim();
}

// next typegen writes next-env.d.ts and the route types, which a fresh clone lacks and tsc needs.
// CI=1 stops the framework installing packages it misses, and the tsconfig.json it rewrites is put back as committed.
async function writeFrameworkTypes(input: EngineInput): Promise<void> {
    const cwd = join(input.root, input.scope);
    const tsconfig = join(cwd, 'tsconfig.json');
    const committed = existsSync(tsconfig) ? readFileSync(tsconfig, 'utf8') : undefined;
    const result = await run([located(input, 'next'), 'typegen'], {
        cwd,
        timeoutMs: TYPES_TIMEOUT_MS,
        env: { CI: '1' },
    });
    if (committed !== undefined) writeFileSync(tsconfig, committed);
    const said = `${result.stdout}${result.stderr}`;
    const isAbsent = NO_TYPEGEN.some((phrase) => said.includes(phrase));
    if (!isAbsent && result.code !== 0) throw new Error(`The next typegen command failed: ${lastLines(said)}`);
}

function typeFinding(input: EngineInput, line: string): Finding[] {
    const groups = TSC_LINE.exec(line)?.groups;
    if (groups === undefined) return [];
    return [
        {
            check: input.spec.id,
            file: inScope(input, groups['file'] ?? ''),
            line: Number(groups['line']),
            column: Number(groups['column']),
            rule: groups['rule'] ?? 'types',
            message: groups['text'] ?? '',
            fixable: false,
        },
    ];
}

/**
 * Has Next.js write its types, then runs the type check of the scope.
 * @param input the engine input
 * @returns one finding for each type error
 */
export async function frameworkTypes(input: EngineInput): Promise<Finding[]> {
    await writeFrameworkTypes(input);
    const cwd = join(input.root, input.scope);
    const command = [located(input, 'tsc'), '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'];
    const result = await run(command, { cwd, timeoutMs: TYPES_TIMEOUT_MS });
    const found = result.stdout.split('\n').flatMap((line) => typeFinding(input, line));
    if (result.code !== 0 && found.length === 0) throw new Error(`The tsc command failed: ${lastLines(result.stdout)}`);
    return found;
}

/**
 * Builds the app, for a repository that set tools.next.build_in_gate.
 * @param input the engine input
 * @returns one finding for a build that fails
 */
export async function frameworkBuild(input: EngineInput): Promise<Finding[]> {
    if (input.view.tool('next')['build_in_gate'] !== true) return [];
    const cwd = join(input.root, input.scope);
    const flags = (input.view.tool('next')['build_flags'] as string[] | undefined) ?? [];
    const command = [located(input, 'next'), 'build', ...flags];
    const result = await run(command, { cwd, timeoutMs: BUILD_TIMEOUT_MS, env: { CI: '1' } });
    if (result.code === 0) return [];
    const said = lastLines(`${result.stdout}${result.stderr}`);
    return [
        {
            check: input.spec.id,
            file: inScope(input, 'package.json'),
            line: 1,
            rule: 'build',
            message: `next build failed: ${said}`,
            fixable: false,
        },
    ];
}
