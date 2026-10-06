import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';

test('apply refuses a plan whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = `level = "all"\n${initial}`;
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    {
        using log = openOwnership(session.root);
        expect(() => writeOutputs(session, log)).toThrow(
            'The gspot.toml file changed while gspot was running. Run the command again.',
        );
    }
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('an npm runner preserves the authored scripts and adds no task of its own', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'run_with = "bun"\n[agent_rules]\nenabled = false\n' }),
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const content = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as Required<
        Pick<PackageManifest, 'scripts'>
    >;
    expect(content.scripts).toStrictEqual({ prepare: 'build-app' });
});

test('init refuses an unsafe output ancestor before attempting installation', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'authored.toml': 'untouched = true\n' });
    await createFileTree(sandbox.path, { 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    symlinkSync(outside.path, join(sandbox.path, '.mise'));
    await rejection(
        initCommand(
            buildInitOptions(sandbox.path, {
                configurations: ['spelling'],
                hooks: false,
                ci: 'none',
                runner: 'mise',
                rules: false,
                install: true,
            }),
        ),
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
            initCommand(
                buildInitOptions(sandbox.path, {
                    configurations: ['spelling'],
                    hooks: false,
                    ci: 'none',
                    runner: 'none',
                    rules: false,
                }),
            ),
        ),
    ).toContain('These files were not overwritten by gspot: .gspot/config/typos.toml.');
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
});
