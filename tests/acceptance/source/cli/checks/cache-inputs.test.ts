// Declared cache inputs decide when a cached verdict is reused.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { renameSync, symlinkSync, unlinkSync } from 'node:fs';

test('declared cache inputs include ignored files and invalidate for changed, added, renamed, and deleted inputs', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        `
        const paths = await Array.fromAsync(new Bun.Glob('state/*.txt').scan('.'));
        const values = await Promise.all(paths.map((path) => Bun.file(path).text()));
        process.exit(values.length > 0 && values.every((value) => value === 'valid') ? 0 : 1);
    `,
    ];
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\nstate/\n',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
inputs = ["state/**/*.txt"]
stage = "commit"
`,
        'selected.txt': 'unchanged trigger',
        'state/current.txt': 'valid',
    });
    const args = ['check', '--only', 'project/state', '--json'];
    const first = await run(sandbox.path, args);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(first.stdout)).checks[0]!.status).toBe('ok');
    const cached = await run(sandbox.path, args);
    expect(cached.code, cached.stdout + cached.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(cached.stdout)).checks[0]!.status).toBe('cache');
    await Bun.write(join(sandbox.path, 'state/current.txt'), 'invalid');
    const changed = await run(sandbox.path, args);
    expect(changed.code).toBe(1);
    expect(reportSchema.parse(JSON.parse(changed.stdout)).checks[0]!.check).toBe('project/state');
    await Bun.write(join(sandbox.path, 'state/current.txt'), 'valid');
    const ran = await run(sandbox.path, args);
    expect(ran.code).toBe(0);
    await Bun.write(join(sandbox.path, 'state/added.txt'), 'invalid');
    const added = await run(sandbox.path, args);
    expect(added.code).toBe(1);
    unlinkSync(join(sandbox.path, 'state/added.txt'));
    const removed = await run(sandbox.path, args);
    expect(removed.code).toBe(0);
    renameSync(join(sandbox.path, 'state/current.txt'), join(sandbox.path, 'state/renamed.txt'));
    const renamed = await run(sandbox.path, args);
    expect(renamed.code).toBe(0);
    expect(reportSchema.parse(JSON.parse(renamed.stdout)).checks[0]!.status).toBe('ok');
    unlinkSync(join(sandbox.path, 'state/renamed.txt'));
    const deleted = await run(sandbox.path, args);
    expect(deleted.code).toBe(1);
});

test.each([{ inputs: [] }, { inputs: ['../outside'] }, { inputs: ['/outside'] }, { inputs: [String.raw`state\file`] }])(
    'invalid cache inputs %j refuse the check before its command writes',
    async ({ inputs }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'selected.txt': 'authored',
            'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/state"
command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("selected.txt", "changed")'])}
paths = ["selected.txt"]
inputs = ${JSON.stringify(inputs)}
stage = "commit"
`,
        });
        const ran = await run(sandbox.path, ['check']);
        expect(ran.code).toBe(2);
        expect(await Bun.file(join(sandbox.path, 'selected.txt')).text()).toBe('authored');
    },
);

test('a declared symlink input invalidates the cached verdict when its target changes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\nstate/\n',
        'state/.keep': '',
        'target.txt': 'valid',
        'selected.txt': 'authored',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/linked-input"
command = ${JSON.stringify([process.execPath, '-e', 'process.exit((await Bun.file("state/input.txt").text()) === "valid" ? 0 : 1)'])}
paths = ["selected.txt"]
inputs = ["state/**/*.txt"]
stage = "commit"
`,
    });
    symlinkSync('../target.txt', join(sandbox.path, 'state/input.txt'));
    const args = ['check', '--only', 'project/linked-input', '--json'];
    const ran = await run(sandbox.path, args);
    expect(ran.code).toBe(0);
    const cached = await run(sandbox.path, args);
    expect(cached.code).toBe(0);
    expect(reportSchema.parse(JSON.parse(cached.stdout)).checks[0]!.status).toBe('cache');
    await Bun.write(join(sandbox.path, 'target.txt'), 'invalid');
    const invalid = await run(sandbox.path, args);
    expect(invalid.code).toBe(1);
    await Bun.write(join(sandbox.path, 'target.txt'), 'valid');
    const valid = await run(sandbox.path, args);
    expect(valid.code).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'selected.txt')).text()).toBe('authored');
});
