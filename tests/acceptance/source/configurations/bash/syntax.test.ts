import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines and finding counts.
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

test.each([
    { check: 'bash/syntax', path: 'script.sh', files: 2, broken: 'if then\n' },
    { check: 'bash/zsh-syntax', path: 'script.zsh', files: 2, broken: 'if then\n' },
    {
        check: 'bash/bats-syntax',
        path: 'script.bats',
        files: 1,
        broken: '@test "broken" {\n    if then\n}\n',
    },
])(
    '$check reports syntax in $path and accepts its correction',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
            'script.sh': 'echo example\n',
            launcher: '#!/usr/bin/env -S bash -e\necho example\n',
            'script.zsh': 'repeat 2 do print example; done\n',
            zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
            'script.bats': '@test "example" {\n    true\n}\n',
        });
        const environment = { PATH: toolsPath(['bats']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache', '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = JSON.parse(clean.stdout) as { checks: { files: number; status: string }[] };
        expect(report.checks[0]?.status).toBe('ok');
        expect(report.checks[0]?.files).toBe(entry.files);
        const path = join(sandbox.path, entry.path);
        const original = readFileSync(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await run(
                sandbox.path,
                ['check', '--only', entry.check, '--no-cache', '--json'],
                environment,
            );
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = reportSchema.parse(JSON.parse(broken.stdout));
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing({
                    file: entry.path,
                    line: entry.check === 'bash/syntax' ? 1 : 2,
                    message: textContaining(entry.check === 'bash/zsh-syntax' ? 'parse error' : 'syntax'),
                }),
            );
        } finally {
            await Bun.write(path, original);
        }
        const corrected = await run(
            sandbox.path,
            ['check', '--only', entry.check, '--no-cache', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: entry.check, status: 'ok', files: entry.files, findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);
