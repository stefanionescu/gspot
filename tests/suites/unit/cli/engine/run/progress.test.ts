import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import type { CheckProgress } from '#cli/types/engine/run.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { waitForFile } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('progress is reported as soon as each check ends, with ignores applied to the final results', async () => {
    const tables = stringify({
        ignore: [{ check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' }],
        command_check: [
            {
                id: 'project/fast',
                paths: ['source.sh'],
                stage: 'commit',
                command: buildProgramCommand(
                    'fakes/tool',
                    '--stdout',
                    'source.sh:demo:Ignored finding\n',
                    '--exit',
                    '1',
                ),
                output: { format: 'regex', pattern: '^(?<file>[^:]+):(?<rule>[^:]+):(?<message>.*)$' },
            },
            {
                id: 'project/waiting',
                paths: ['source.sh'],
                stage: 'commit',
                command: buildProgramCommand('fakes/tool', '--until', 'completed'),
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'source.sh': 'echo example\n',
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
    });

    const finished: number[] = [];
    const ready = Promise.withResolvers<number>();
    const running = runChecks(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['project/fast', 'project/waiting'],
            onProgress: (progress) => {
                finished.push(progress.finished);
                if (progress.finished === 1) ready.resolve(progress.finished);
            },
        }),
    );
    await Promise.race([ready.promise, running]);
    await writeFile(join(sandbox.path, 'completed'), 'ready');
    const result = await running;
    expect(result.report.exitCode).toBe(0);
    expect(finished).toStrictEqual([1, 2]);
    expect(result.report.checks.map((each) => each.check)).toStrictEqual(['project/fast', 'project/waiting']);
    expect(result.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
    expect(result.report.ignores).toStrictEqual([
        { check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' },
    ]);
});

test('a check still running at the progress interval is reported as running, and then as finished', async () => {
    const command = buildProgramCommand('fakes/tool', '--write', 'started=yes', '--until', 'completed');
    const waiting = { id: 'project/waiting', paths: ['notes.txt'], stage: 'commit', command };
    await using sandbox = await createGitSandbox({
        'notes.txt': 'plain\n',
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [waiting] }) }),
    });
    const events: CheckProgress[] = [];
    const ticks: Array<() => void> = [];
    using _clock = spyOn(globalThis, 'setInterval').mockImplementation(((tick: () => void) => {
        ticks.push(tick);
        return 0;
    }) as typeof setInterval);
    const running = runChecks(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['project/waiting'],
            onProgress: (progress) => {
                events.push(progress);
            },
        }),
    );
    expect(await waitForFile(join(sandbox.path, 'started'))).toBe(true);
    for (const tick of ticks) tick();
    await writeFile(join(sandbox.path, 'completed'), 'ready');
    await running;
    expect(events.find(({ kind }) => kind === 'running')).toMatchObject({
        running: [{ check: 'project/waiting', scope: '' }],
        finished: 0,
        total: 1,
    });
    expect(events.at(-1)).toMatchObject({ kind: 'finished', check: 'project/waiting', finished: 1 });
});
