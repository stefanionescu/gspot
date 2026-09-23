// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines and finding counts.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test(
    'syntax checks use each file dialect and reject its broken syntax',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["bash"]\n',
            'script.sh': 'echo example\n',
            launcher: '#!/usr/bin/env -S bash -e\necho example\n',
            'script.zsh': 'repeat 2 do print example; done\n',
            zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
            'script.bats': '@test "example" {\n    true\n}\n',
        });
        const environment = { PATH: toolsPath(['bats']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const cases = [
            { check: 'bash/syntax', path: 'script.sh', files: 2, broken: 'if then\n' },
            { check: 'bash/zsh-syntax', path: 'script.zsh', files: 2, broken: 'if then\n' },
            {
                check: 'bash/bats-syntax',
                path: 'script.bats',
                files: 1,
                broken: '@test "broken" {\n    if then\n}\n',
            },
        ];
        for (const entry of cases) {
            const clean = await run(
                sandbox.path,
                ['check', '--only', entry.check, '--no-cache', '--json'],
                environment,
            );
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const report = JSON.parse(clean.stdout) as { checks: { files: number; status: string }[] };
            expect(report.checks[0]?.status).toBe('ok');
            expect(report.checks[0]?.files).toBe(entry.files);
            const path = join(sandbox.path, entry.path);
            const original = readFileSync(path);
            try {
                await Bun.write(path, entry.broken);
                const broken = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache'], environment);
                expect(broken.code, broken.stdout + broken.stderr).toBe(1);
                expect(broken.stdout).toContain(entry.path);
                expect(broken.stdout).toContain('syntax');
            } finally {
                await Bun.write(path, original);
            }
        }
    },
    PLANTED_TIMEOUT_MS,
);
