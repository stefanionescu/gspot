import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };
import { rejection } from '#tests/support/rejection.ts';

const { version: GSPOT_VERSION } = packageManifest;

test('apply refuses a proposal whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = initial.replace('version = 1', 'version = 1\nlevel = "all"');
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    expect((await rejection(applyAll(session))).message).toContain('changed after generation was planned');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('an npm runner preserves the authored prepare command while adding explicit check scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[runner]\ntool = "bun"\n[rules]\ninstall = false\n',
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    await applyAll(await openSession(sandbox.path));
    const content = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
    };
    expect(content.scripts['prepare']).toBe('build-app');
    expect(content.scripts['gspot:check']).toBe('gspot check');
    expect(content.scripts['gspot:apply']).toBe('gspot apply');
});

test('init refuses an unsafe output ancestor before attempting installation', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'authored.toml': 'untouched = true\n' });
    await createFileTree(sandbox.path, { 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    symlinkSync(outside.path, join(sandbox.path, '.mise'));
    await rejection(
        initCommand({
            cwd: sandbox.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['spelling'],
            isListExact: true,
            hooks: 'none',
            ci: 'none',
            runner: 'mise',
            rules: 'no',
            install: true,
            allowDirty: true,
        }),
    );
    expect(readFileSync(join(outside.path, 'authored.toml'), 'utf8')).toBe('untouched = true\n');
    expect(existsSync(join(outside.path, 'conf.d/gspot-tools.toml'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(
        '[default.extend-words]\nAuthored = "Authored"\n',
    );
});

test('init retains old configuration when a conflicting replacement cannot be published', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    const conflict = '# Maintained independently.\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored, '.gspot/config/typos.toml': conflict });
    expect(
        (
            await rejection(
                initCommand({
                    cwd: sandbox.path,
                    yes: true,
                    isDryRun: false,
                    json: true,
                    configurations: ['spelling'],
                    isListExact: true,
                    hooks: 'none',
                    ci: 'none',
                    runner: 'none',
                    rules: 'no',
                    install: false,
                    allowDirty: true,
                }),
            )
        ).message,
    ).toContain('Setup preserved conflicting outputs');
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
});
