import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { FIX_SUMMARY_CASES } from '#tests/data/commands/check/fixes/feedback.ts';

test.each([...FIX_SUMMARY_CASES])(
    'check --fix --dry-run shows the diff and writes nothing, and check --fix reports $name',
    async ({ paths, preview, applied }) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/feedback',
                        command: [process.execPath, '-e', 'process.exitCode = 0'],
                        fix: [
                            process.execPath,
                            '-e',
                            String.raw`for (const path of ${JSON.stringify(paths)}) await Bun.write(path, 'corrected\n');`,
                        ],
                        paths: ['*.txt'],
                        stage: 'commit',
                    },
                ],
            }),
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'source.txt': 'original\n',
            'other.txt': 'original\n',
            'control.md': '# Preserve this file\n',
            ...Object.fromEntries(paths.map((path) => [path, 'original\n'])),
        });
        const planned = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix', '--dry-run']);
        expect(planned.code, planned.stdout + planned.stderr).toBe(0);
        expect(planned.stdout).toContain(`${preview}\n`);
        expect(planned.stdout.split('\n').filter((line) => line === '-original')).toHaveLength(paths.length);
        expect(planned.stdout.split('\n').filter((line) => line === '+corrected')).toHaveLength(paths.length);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(await readFile(join(sandbox.path, 'other.txt'), 'utf8')).toBe('original\n');
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toContain(applied);
        expect(corrected.stderr).not.toContain(applied);
        for (const path of new Set(['source.txt', 'other.txt', ...paths]))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
                new Set<string>(paths).has(path) ? 'corrected\n' : 'original\n',
            );
        expect(await readFile(join(sandbox.path, 'control.md'), 'utf8')).toBe('# Preserve this file\n');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);
