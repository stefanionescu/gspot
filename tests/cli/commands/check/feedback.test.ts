import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { DETECTED_SOURCE, FIXER_FEEDBACK_CASES } from '#tests/config/cli/commands/check/feedback.ts';

test.each(FIXER_FEEDBACK_CASES)(
    'check correction feedback names $name and preserves preview bytes',
    async ({ paths, preview, applied }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([], {
            tables: stringify({
                check: {
                    'sandbox/feedback': {
                        command: [process.execPath, '-e', 'process.exitCode = 0'],
                        fix: [
                            process.execPath,
                            '-e',
                            String.raw`for (const path of ${JSON.stringify(paths)}) await Bun.write(path, 'corrected\n');`,
                        ],
                        paths: ['*.txt'],
                        stage: 'commit',
                    },
                },
            }),
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            ...DETECTED_SOURCE,
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
                paths.includes(path) ? 'corrected\n' : 'original\n',
            );
        expect(await readFile(join(sandbox.path, 'control.md'), 'utf8')).toBe('# Preserve this file\n');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
        expect(await readFile(join(sandbox.path, 'added.py'), 'utf8')).toBe(DETECTED_SOURCE['added.py']);
    },
);
