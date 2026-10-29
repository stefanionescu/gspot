import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { DURATION } from '#tests/config/commands/check/report.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { FIX_SUMMARY_CASES } from '#tests/config/commands/check/fixes/feedback.ts';

test.each([...FIX_SUMMARY_CASES])(
    'check --fix --dry-run shows the diff and writes nothing, and check --fix reports $name',
    async ({ paths, previewText, appliedText }) => {
        await using sandbox = await createGitSandbox({});
        const settings = buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/feedback',
                        command: buildProgramCommand('fakes/tool'),
                        fix: buildProgramCommand('fakes/tool', '--text', 'corrected\n', ...paths),
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
        expect(planned.stdout.replaceAll(DURATION, '0.0s')).toBe(previewText);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(await readFile(join(sandbox.path, 'other.txt'), 'utf8')).toBe('original\n');
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/feedback', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout.replaceAll(DURATION, '0.0s')).toBe(appliedText);
        expect(corrected.stderr).toBe('');
        const checkedPaths = new Set(['source.txt', 'other.txt', ...paths]);
        for (const path of checkedPaths)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
                new Set<string>(paths).has(path) ? 'corrected\n' : 'original\n',
            );
        expect(await readFile(join(sandbox.path, 'control.md'), 'utf8')).toBe('# Preserve this file\n');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);
