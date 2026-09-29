import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection } from '#tests/support/expectations.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';

test('apply refuses a plan whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = policyOf([], '[guides]\ninstall = false\n');
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = initial.replace('version = 1', 'version = 1\nlevel = "all"');
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    expect(await rejection(applyAll(session))).toContain('changed after generation was planned');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('an npm runner preserves the authored scripts and adds no task of its own', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[runner]\ntool = "bun"\n[guides]\ninstall = false\n'),
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    await applyAll(await openSession(sandbox.path));
    const content = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
    };
    expect(content.scripts).toStrictEqual({ prepare: 'build-app' });
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
            kits: ['spelling'],
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
        await rejection(
            initCommand({
                cwd: sandbox.path,
                yes: true,
                isDryRun: false,
                json: true,
                kits: ['spelling'],
                isListExact: true,
                hooks: 'none',
                ci: 'none',
                runner: 'none',
                rules: 'no',
                install: false,
                allowDirty: true,
            }),
        ),
    ).toContain('Setup preserved conflicting outputs');
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
});
