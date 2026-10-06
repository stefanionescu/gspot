import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { FIXER_FEEDBACK_CASES } from '#tests/config/cli/commands/correction-feedback.ts';

test.each(FIXER_FEEDBACK_CASES)(
    'check correction feedback names $name and preserves preview bytes',
    async ({ paths, preview, applied }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([], {
            tables: stringify({
                agent_rules: { enabled: false },
                check: [
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
            'gspot.toml': policy,
            'source.txt': 'original\n',
            'other.txt': 'original\n',
            'control.md': '# Preserve this file\n',
            ...Object.fromEntries(paths.map((path) => [path, 'original\n'])),
        });
        const planned = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix', '--dry-run']);
        expect(planned.code, planned.stdout + planned.stderr).toBe(0);
        expect(planned.stdout).toContain(`${preview}\n`);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(readFileSync(join(sandbox.path, 'other.txt'), 'utf8')).toBe('original\n');
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stderr).toContain(applied);
        expect(corrected.stdout).not.toContain(applied);
        for (const path of new Set(['source.txt', 'other.txt', ...paths]))
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(
                paths.includes(path) ? 'corrected\n' : 'original\n',
            );
        expect(readFileSync(join(sandbox.path, 'control.md'), 'utf8')).toBe('# Preserve this file\n');
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    },
);
