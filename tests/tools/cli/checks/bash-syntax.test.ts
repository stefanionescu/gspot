// Host Bash and Zsh and the pinned Bats parse planted scripts after apply writes the configuration.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

test.each([
    { check: 'bash/syntax', path: 'script.sh', files: 2, broken: 'if then\n' },
    // Windows has no zsh to install; the Linux runners install it and macOS ships it.
    ...(onPosix ? [{ check: 'bash/zsh-syntax', path: 'script.zsh', files: 2, broken: 'if then\n' }] : []),
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
            'gspot.toml': policyOf(['bash'], '', 'all'),
            'script.sh': 'echo example\n',
            launcher: '#!/usr/bin/env -S bash -e\necho example\n',
            'script.zsh': 'repeat 2 do print example; done\n',
            zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
            'script.bats': '@test "example" {\n    true\n}\n',
        });
        const environment = { PATH: toolsPath(['bats']) };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = JSON.parse(clean.stdout) as { checks: { files: number; status: string }[] };
        expect(report.checks[0]?.status).toBe('ok');
        expect(report.checks[0]?.files).toBe(entry.files);
        const path = join(sandbox.path, entry.path);
        const original = readFileSync(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = JSON.parse(broken.stdout) as RunReport;
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
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: entry.check, status: 'ok', files: entry.files, findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);
