import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('a leftover local file cannot hide ShellCheck while an explicit skip applies only to that run', async () => {
    await using directory = await testdir();
    const local = 'skip = ["bash/shellcheck"]\n';
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
        'gspot.local.toml': local,
        'entry.sh': '#!/usr/bin/env bash\necho $1\n',
    });
    const environment = { PATH: toolsPath(['shellcheck']) };
    const applied = await run(directory.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'bash/shellcheck', '--json'];
    const checked = await run(directory.path, command, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toStrictEqual([
        containing({ file: 'entry.sh', line: 2, rule: 'SC2086' }),
    ]);
    const skipped = await run(directory.path, [...command, '--skip', 'bash/shellcheck'], environment);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    expect((JSON.parse(skipped.stdout) as RunReport).skips).toStrictEqual([
        { check: 'bash/shellcheck', source: 'flag' },
    ]);
    const doctor = await run(directory.path, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).not.toBe(2);
    const report = JSON.parse(doctor.stdout) as {
        changes: { configurationNotOwned: { path: string; note: string }[] };
    };
    expect(report.changes.configurationNotOwned.filter(({ path }) => path === 'gspot.local.toml')).toStrictEqual([
        containing({
            path: 'gspot.local.toml',
            note: 'No command reads this file. Use --skip for one run.',
        }),
    ]);
    expect(readFileSync(join(directory.path, 'gspot.local.toml'), 'utf8')).toBe(local);
    writeFileSync(join(directory.path, 'entry.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    const corrected = await run(directory.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
