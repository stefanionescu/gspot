import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { FIXER_FEEDBACK_CASES } from '#tests/config/check.ts';

/** New language evidence stays authored until the owner runs apply. */

test.each([...FIXER_FEEDBACK_CASES])(
    'check --fix reports $name, and --dry-run writes nothing',
    async ({ paths, preview, applied }) => {
        await using sandbox = await testdir();
        const settings = settingsText([], {
            tables: stringify({
                command_check: [
                    {
                        name: 'sandbox/feedback',
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
            'added.py': 'pass\n',
            'source.txt': 'original\n',
            'other.txt': 'original\n',
            'control.md': '# Preserve this file\n',
            ...Object.fromEntries(paths.map((path) => [path, 'original\n'])),
        });
        const planned = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix', '--dry-run']);
        expect(planned.code, planned.stdout + planned.stderr).toBe(0);
        expect(planned.stdout).toContain(`${preview}\n`);
        expect(planned.stderr).not.toMatch(/The saved setup is stale:|Setup detection could not finish:/u);
        expect(planned.stdout.split('\n').filter((line) => line === '-original')).toHaveLength(paths.length);
        expect(planned.stdout.split('\n').filter((line) => line === '+corrected')).toHaveLength(paths.length);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(await readFile(join(sandbox.path, 'other.txt'), 'utf8')).toBe('original\n');
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stderr).toContain(applied);
        expect(corrected.stdout).not.toContain(applied);
        expect(corrected.stderr).not.toMatch(/The saved setup is stale:|Setup detection could not finish:/u);
        for (const path of new Set(['source.txt', 'other.txt', ...paths]))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
                new Set<string>(paths).has(path) ? 'corrected\n' : 'original\n',
            );
        expect(await readFile(join(sandbox.path, 'control.md'), 'utf8')).toBe('# Preserve this file\n');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readFile(join(sandbox.path, 'added.py'), 'utf8')).toBe('pass\n');
    },
);
