// Host Bash and Zsh and the pinned Bats parse test scripts after apply writes the configuration.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

test.each([
    { check: 'bash/syntax', path: 'script.sh', files: 2, broken: 'if then\n' },
    // Windows has no zsh to install, and it runs no Bats, a Bash script, from PATH; Linux and macOS have both.
    ...(isPosix
        ? [
              { check: 'bash/zsh', path: 'script.zsh', files: 2, broken: 'if then\n' },
              {
                  check: 'bash/bats',
                  path: 'script.bats',
                  files: 1,
                  broken: '@test "broken" {\n    if then\n}\n',
              },
          ]
        : []),
])(
    '$check reports syntax in $path and accepts its correction',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
            'script.sh': 'echo example\n',
            launcher: '#!/usr/bin/env -S bash -e\necho example\n',
            'script.zsh': 'repeat 2 do print example; done\n',
            zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
            'script.bats': '@test "example" {\n    true\n}\n',
        });
        const environment = { PATH: buildToolsPath(isPosix ? ['bats'] : []) };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = JSON.parse(clean.stdout) as RunReport;
        expect(report.checks[0]?.status).toBe('passed');
        expect(report.checks[0]?.fileCount).toBe(entry.files);
        const path = join(sandbox.path, entry.path);
        const original = readFileSync(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = JSON.parse(broken.stdout) as RunReport;
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing({
                    file: entry.path,
                    line: entry.check === 'bash/syntax' ? 1 : 2,
                    message: textContaining(entry.check === 'bash/zsh' ? 'parse error' : 'syntax'),
                }),
            );
        } finally {
            await Bun.write(path, original);
        }
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: entry.check, status: 'passed', fileCount: entry.files, findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
