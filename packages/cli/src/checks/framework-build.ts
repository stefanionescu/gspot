// The Next.js checks that run the framework: the type check after the framework wrote its types, and the build.
import { join } from 'node:path';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { stripVTControlCharacters } from 'node:util';
import { rmSync } from 'node:fs';
import { scratchCopy } from '#cli/run/fixers.ts';

const SHOWN_LINES = 3;
const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<column>\d+)\): error (?<rule>TS\d+): (?<text>.*)$/u;
// A Next.js before 15.5 has no typegen command and reads the word as a project folder.
const NO_TYPEGEN = ['Invalid project directory', 'unknown command'];

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
// CI=1 stops the framework installing packages it misses; generated files stay in the scratch copy.
async function writeFrameworkTypes(input: EngineInput): Promise<void> {
    const cwd = join(input.root, input.scope);
    const result = await runCheckCommand(input, ['next', 'typegen'], {
        cwd,
        env: { CI: '1' },
    });
    const said = `${result.stdout}${result.stderr}`;
    const isAbsent = NO_TYPEGEN.some((phrase) => said.includes(phrase));
    if (!isAbsent && result.code !== 0) throw new Error(`The next typegen command failed: ${lastLines(said)}`);
}

function typeFinding(input: EngineInput, line: string): Finding[] {
    const groups = TSC_LINE.exec(line)?.groups;
    if (groups === undefined) return [];
    return [
        {
            check: input.spec.name,
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
    const scratch = scratchCopy(
        input.session,
        input.session.repository.files.map((file) => file.path),
    );
    const isolated = { ...input, root: scratch, session: { ...input.session, root: scratch } };
    try {
        await writeFrameworkTypes(isolated);
        const cwd = join(scratch, input.scope);
        const command = ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'];
        const result = await runCheckCommand(isolated, command, { cwd });
        const found = result.stdout.split('\n').flatMap((line) => typeFinding(input, line));
        if (result.code !== 0 && found.length === 0)
            throw new Error(`The tsc command failed: ${lastLines(`${result.stdout}\n${result.stderr}`)}`);
        return found;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

/**
 * Builds the app, for a repository that set tools.next.build_in_gate.
 * @param input the engine input
 * @returns one finding for a build that fails
 */
export async function frameworkBuild(input: EngineInput): Promise<Finding[]> {
    const scratch = scratchCopy(
        input.session,
        input.session.repository.files.map((file) => file.path),
    );
    const isolated = { ...input, root: scratch, session: { ...input.session, root: scratch } };
    try {
        const cwd = join(scratch, input.scope);
        const flags = (input.view.tool('next')['build_flags'] as string[] | undefined) ?? [];
        const command = ['next', 'build', ...flags];
        const result = await runCheckCommand(isolated, command, { cwd, env: { CI: '1' } });
        if (result.code === 0) return [];
        const said = lastLines(`${result.stdout}${result.stderr}`);
        return [
            {
                check: input.spec.name,
                file: inScope(input, 'package.json'),
                line: 1,
                rule: 'build',
                message: `next build failed: ${said}`,
                fixable: false,
            },
        ];
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
