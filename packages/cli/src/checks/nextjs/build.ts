import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { findingAt } from '#cli/checks/result.ts';
import { stripVTControlCharacters } from 'node:util';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { TSC_LINE, CAUSE_MARKS, SHOWN_LINES } from '#cli/config/checks/platforms.ts';

// The marked line and the one after it.
const MARKED_LINES = 2;
// Next.js puts the cause and its detail above the longer stack trace.
function lastLines(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

// next typegen writes next-env.d.ts and the route types, which a fresh clone lacks and tsc needs.
// CI=1 stops Next.js installing missing packages; generated files stay in the scratch copy.
async function writeNextjsTypes(input: EngineInput): Promise<void> {
    const cwd = join(input.root, input.scope);
    const result = await runCheckCommand(input, ['next', 'typegen'], {
        cwd,
        env: { CI: '1' },
    });
    const said = `${result.stdout}${result.stderr}`;
    if (result.code !== 0) throw new Error(`The next typegen command failed: ${lastLines(said)}`);
}

function typeFinding(input: EngineInput, line: string): Finding[] {
    const groups = TSC_LINE.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'];
    if (file === undefined) return [];
    const rule = groups['rule'];
    if (rule === undefined) return [];
    const text = groups['text'];
    if (text === undefined) return [];
    return [
        findingAt(
            input,
            {
                file: input.scope === '' ? file : `${input.scope}/${file}`,
                line: Number(groups['line']),
                column: Number(groups['column']),
            },
            rule,
            text,
        ),
    ];
}

/**
 * Has Next.js write its types, then runs the type check of the scope.
 * @param input the engine input
 * @returns one finding for each type error
 */
export async function nextjsTypes(input: EngineInput): Promise<Finding[]> {
    const scratch = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    try {
        await writeNextjsTypes(isolated);
        const cwd = join(scratch, input.scope);
        const command = ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'];
        const result = await runCheckCommand(isolated, command, { cwd });
        const found = result.stdout.split('\n').flatMap((line) => typeFinding(input, line));
        const said = `${result.stdout}\n${result.stderr}`;
        if (result.code !== 0 && found.length === 0) throw new Error(`The tsc command failed: ${lastLines(said)}`);
        return found;
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}

/**
 * Builds the app, for a repository that set tools.next.build_in_gate.
 * @param input the engine input
 * @returns one finding for a build that fails
 */
export async function nextjsBuild(input: EngineInput): Promise<Finding[]> {
    const scratch = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    try {
        const cwd = join(scratch, input.scope);
        const flags = (input.view.tool('next')['build_flags'] as string[] | undefined) ?? [];
        const command = ['next', 'build', ...flags];
        const result = await runCheckCommand(isolated, command, { cwd, env: { CI: '1' } });
        if (result.code === 0) return [];
        const said = lastLines(`${result.stdout}${result.stderr}`);
        return [
            findingAt(
                input,
                { file: input.scope === '' ? 'package.json' : `${input.scope}/package.json`, line: 1 },
                'build',
                `next build failed: ${said}`,
            ),
        ];
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}
