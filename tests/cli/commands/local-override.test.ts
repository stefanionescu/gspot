import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import type { RunReport } from '#cli/types/execution/runtime.ts';

// A declared check on host Bun that fails while entry.txt says bad.
const POLICY = `configurations = []
[[check]]
name = "project/entry"
command = ${JSON.stringify([process.execPath, '-e', "process.exit((await Bun.file('entry.txt').text()).includes('bad') ? 1 : 0)"])}
paths = ["entry.txt"]
stage = "commit"
`;

test('a leftover local file cannot hide a check while an explicit skip applies only to that run', async () => {
    await using directory = await testdir();
    const local = 'skip = ["project/entry"]\n';
    await createFileTree(directory.path, {
        'gspot.toml': POLICY,
        'gspot.local.toml': local,
        'entry.txt': 'bad\n',
    });
    const command = ['check', '--only', 'project/entry', '--json'];
    const checked = await runGspot(directory.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'project/entry', status: 'failed' },
    ]);
    const skipped = await runGspot(directory.path, [...command, '--skip', 'project/entry']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    expect((JSON.parse(skipped.stdout) as RunReport).skips).toStrictEqual([{ check: 'project/entry', cause: 'flag' }]);
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await runGspot(directory.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const doctor = await runGspot(directory.path, ['doctor', '--json']);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'gspot.local.toml'), 'utf8')).toBe(local);
    const resumed = await runGspot(directory.path, command);
    expect(resumed.code, resumed.stdout + resumed.stderr).toBe(1);
    expect((JSON.parse(resumed.stdout) as RunReport).checks).toMatchObject([
        { check: 'project/entry', status: 'failed' },
    ]);
});
