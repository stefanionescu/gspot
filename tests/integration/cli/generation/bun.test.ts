import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('Bun safeguards preserve stricter age and unrelated fields across apply and restoration', async () => {
    await using repository = await testdir();
    const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
    await createFileTree(repository.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["dependencies"]\n[tools.install]\nsecurity_scanner = "@socketsecurity/bun-security-scanner"\n[rules]\ninstall = false\n',
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': original,
    });
    const renderSession1 = await openSession(repository.path);
    const generated = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).configurations.find((entry) => entry.path === 'bunfig.toml')!;
    const owner = openLifecycleOwner(repository.path);
    owner.applyProposal(owner.proposeConfiguration(generated.path, generated.format, generated.changes, true));
    const installed = readFileSync(join(repository.path, 'bunfig.toml'), 'utf8');
    expect(Bun.TOML.parse(installed)).toStrictEqual({
        install: {
            exact: true,
            minimumReleaseAge: 1_209_600,
            security: { scanner: '@socketsecurity/bun-security-scanner' },
        },
    });
    expect(installed).toContain('# Authored installation choices');
    expect(
        owner.applyProposal(owner.proposeConfiguration(generated.path, generated.format, generated.changes, true)),
    ).toBe('unchanged');
    expect(owner.restore('bunfig.toml')).toBe('changed');
    owner.close();
    expect(readFileSync(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(original);
});

test('initialization carries root and scoped Bun safeguards into editable policy', async () => {
    const { initCommand } = await import('#cli/commands/init/command.ts');
    await using repository = await testdir();
    const rootBun =
        '[install]\nexact = true\nminimumReleaseAge = 1209600\n[install.security]\nscanner = "root-scanner"\n';
    const scopedBun = '[install]\nminimumReleaseAge = 1814400\n[install.security]\nscanner = "scope-scanner"\n';
    await createFileTree(repository.path, {
        'bunfig.toml': rootBun,
        'app/bunfig.toml': scopedBun,
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'app/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const result = await initCommand({
        cwd: repository.path,
        yes: true,
        isDryRun: false,
        json: true,
        configurations: ['dependencies'],
        scopes: ['app=dependencies'],
        isListExact: true,
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    });
    expect(result.exitCode, result.text).toBe(0);
    const policy = Bun.TOML.parse(readFileSync(join(repository.path, 'gspot.toml'), 'utf8'));
    expect(policy).toMatchObject({
        tools: { install: { min_release_age_days: 14, security_scanner: 'root-scanner' } },
        scope: [{ path: 'app', tools: { install: { min_release_age_days: 21, security_scanner: 'scope-scanner' } } }],
    });
    expect(readFileSync(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(rootBun);
    expect(readFileSync(join(repository.path, 'app/bunfig.toml'), 'utf8')).toBe(scopedBun);
});
