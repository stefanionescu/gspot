import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/output/schema.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { toolsPath } from '#tests/support/cli/tools.ts';

test('a leftover local file cannot hide ShellCheck while an explicit skip applies only to that run', async () => {
    await using directory = await testdir();
    const local = 'skip = ["bash/shellcheck"]\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
        'gspot.local.toml': local,
        'entry.sh': '#!/usr/bin/env bash\necho $1\n',
    });
    const environment = { PATH: toolsPath(['shellcheck']) };
    const applied = await run(directory.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'bash/shellcheck', '--no-cache', '--json'];
    const checked = await run(directory.path, command, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(checked.stdout)).checks[0]?.findings).toStrictEqual([
        expect.objectContaining({ file: 'entry.sh', line: 2, rule: 'SC2086' }),
    ]);
    const skipped = await run(directory.path, [...command, '--skip', 'bash/shellcheck'], environment);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(skipped.stdout)).skips).toStrictEqual([
        { check: 'bash/shellcheck', source: 'flag' },
    ]);
    const doctor = await run(directory.path, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).not.toBe(2);
    const report = JSON.parse(doctor.stdout) as {
        changes: { configurationNotOwned: { path: string; note: string }[] };
    };
    expect(report.changes.configurationNotOwned.filter(({ path }) => path === 'gspot.local.toml')).toStrictEqual([
        expect.objectContaining({
            path: 'gspot.local.toml',
            note: 'No command reads this file. Use --skip for one run.',
        }),
    ]);
    expect(readFileSync(join(directory.path, 'gspot.local.toml'), 'utf8')).toBe(local);
    writeFileSync(join(directory.path, 'entry.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    const corrected = await run(directory.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
