import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { FIX_ROUNDS } from '#cli/config/engine.ts';
import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a later pass formats what a fix after the formatter wrote', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'project/format',
                stage: 'commit',
                paths: ['*.txt'],
                command: buildProgramCommand('checks/search', '--text', '  ', '--', '{files}'),
                fix: buildProgramCommand('checks/replacement', '  ', ' ', '{files}'),
            },
            {
                id: 'project/codemod',
                stage: 'commit',
                paths: ['*.txt'],
                command: buildProgramCommand('checks/search', '--text', 'var', '--', '{files}'),
                fix: buildProgramCommand('checks/replacement', 'var', 'let ', '{files}'),
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'source.txt': 'var x\n',
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
    });

    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/format', 'project/codemod'] });
    const result = await runChecks(await openSession(sandbox.path), options);
    expect(result.report.exitCode, JSON.stringify(result.report.checks)).toBe(0);
    expect(result.fixes?.results).toMatchObject([
        { check: 'project/format', status: 'changed', changed: ['source.txt'] },
        { check: 'project/codemod', status: 'changed', changed: ['source.txt'] },
    ]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('let x\n');
});

test('a fixer that fails midway leaves the later fixers to run in order and keep their edits', async () => {
    const checks = ['first', 'second', 'third'].map((name, index) => {
        return {
            id: `sandbox/${name}`,
            command: buildProgramCommand('fakes/tool'),
            fix: buildProgramCommand(
                'fakes/tool',
                '--append',
                `order.log=${name}\n`,
                '--write',
                `${name}.txt=fixed\n`,
                '--exit',
                index === 0 ? '3' : '0',
            ),
            paths: [`${name}.txt`],
            stage: 'commit',
        };
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'first.txt': 'original\n',
        'second.txt': 'original\n',
        'third.txt': 'original\n',
    });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ fix: true, only: ['sandbox/first', 'sandbox/second', 'sandbox/third'] }),
    );
    expect(result.fixes?.results.map(({ status }) => status)).toStrictEqual(['failed', 'changed', 'changed']);
    expect(await readFile(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\n');
    for (const name of ['first', 'second', 'third'])
        expect(await readFile(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
});

test('fixers that undo each other stop after the last round', async () => {
    const checks = ['forward', 'backward'].map((text) => ({
        id: `sandbox/${text}`,
        command: buildProgramCommand('fakes/tool'),
        fix: buildProgramCommand('fakes/tool', '--write', `source.txt=${text}`, '--append', `rounds.log=${text}\n`),
        paths: ['source.txt'],
        stage: 'commit',
    }));
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'source.txt': 'backward',
    });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ fix: true, only: ['sandbox/forward', 'sandbox/backward'] }),
    );
    expect(result.report.exitCode).toBe(0);
    // The first round runs both fixers, and each later round runs the one whose file the other changed.
    const runs = await readFile(join(sandbox.path, 'rounds.log'), 'utf8');
    expect(runs.trimEnd().split('\n')).toHaveLength(FIX_ROUNDS + 1);
});
