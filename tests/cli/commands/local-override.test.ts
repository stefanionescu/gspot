import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
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
    const doctor = await runGspot(directory.path, ['doctor', '--json']);
    expect(doctor.code, doctor.stdout + doctor.stderr).not.toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.local.toml'), 'utf8')).toBe(local);
    writeFileSync(join(directory.path, 'entry.txt'), 'good\n');
    const corrected = await runGspot(directory.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
