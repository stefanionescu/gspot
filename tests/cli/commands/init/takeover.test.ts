import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { existsSync, writeFileSync } from 'node:fs';
import { prepare } from '#cli/commands/init/prepare.ts';
import { writeSetup } from '#cli/commands/init/write.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { INVALID_CSS, TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';

test('initialization previews only the managed package field and rejects a later authored edit before any write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': TAKEOVER_PACKAGE, 'source.css': INVALID_CSS });
    const options = buildInitOptions(sandbox.path, { configurations: ['css'] });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.change).toContainEqual({
        path: 'package.json',
        note: 'managed stylelint fields; other content stays',
    });
    expect(prepared.plan.remove.some((entry) => entry.path === 'package.json')).toBe(false);
    expect(
        prepared.plan.retained.some((entry) => entry.path === 'package.json' && entry.note.includes('stylelint')),
    ).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(TAKEOVER_PACKAGE);
    const edited = TAKEOVER_PACKAGE.replace('native-project', 'edited-project');
    writeFileSync(join(sandbox.path, 'package.json'), edited);
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toContain(
        'Configuration changed after init read it: package.json. Run gspot init again.',
    );
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(edited);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot'))).toBe(false);
});

test('initialization does not overwrite a shared file created after its absent-file preview', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' });
    const options = buildInitOptions(sandbox.path, { configurations: ['dependencies'] });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.change).toContainEqual({
        path: 'bunfig.toml',
        note: 'managed install.minimumReleaseAge fields; other content stays',
    });
    const authored = '[install]\nexact = true\n';
    writeFileSync(join(sandbox.path, 'bunfig.toml'), authored);
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toContain(
        'Configuration changed after init read it: bunfig.toml. Run gspot init again.',
    );
    expect(await Bun.file(join(sandbox.path, 'bunfig.toml')).text()).toBe(authored);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot'))).toBe(false);
});
