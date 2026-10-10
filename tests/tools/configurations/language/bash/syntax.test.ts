// Host Bash and Zsh and the pinned Bats parse test scripts after apply writes the configuration.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { SYNTAX_CASES } from '#tests/config/tools/configurations/language/bash/syntax.ts';

// Windows has no Zsh or Bats; Linux and macOS run all three.
test.each(isPosix ? SYNTAX_CASES : SYNTAX_CASES.slice(0, 1))(
    '$check accepts clean files and reports syntax in $path',
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
        const planned = planRun(await openSession(sandbox.path), { stage: 'all', skips: [], only: [entry.check] });
        expect(planned[0]?.files.map(({ path }) => path)).toStrictEqual(entry.files);
        expect(report.checks[0]?.fileCount).toBe(entry.files.length);
        const path = join(sandbox.path, entry.path);
        const original = await readFile(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = JSON.parse(broken.stdout) as RunReport;
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing({
                    file: entry.path,
                    line: entry.line,
                    message: textContaining(entry.message),
                }),
            );
        } finally {
            await Bun.write(path, original);
        }
    },
);

test.skipIf(!isPosix)('Bash findings retain newline and colon directory names without Git', async () => {
    await using sandbox = await testdir();
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['bash/bash-syntax'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(
        [...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(paths);
});
