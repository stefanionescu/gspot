import { expect, test } from 'bun:test';

import { BUN_PROJECT_FILES } from '#tests/config/configurations/general.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('stale-lockfile reports each dependency that package.json and bun.lock disagree on', async () => {
    await using sandbox = await createGitSandbox({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'package.json asks for zod ^4.1.0, but bun.lock records ^4.0.0. Run bun install and commit the lockfile.',
        'package.json declares typescript 0.0.0-test, which bun.lock does not record. Run bun install and commit the lockfile.',
        'bun.lock records left-pad, which package.json no longer declares. Run bun install and commit the lockfile.',
    ]);
});

test('stale-lockfile reports a peer dependency and an unrecorded workspace importer', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'packages/app', configurations: [] }] }),
        'package.json': '{"workspaces":["packages/*"],"peerDependencies":{"react":"^19.0.0"}}',
        'packages/app/package.json': '{"name":"app","dependencies":{"zod":"^4.0.0"}}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{"":{}}}',
    });
    expect([
        ...(await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile')),
        ...(await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile', { scope: 'packages/app' })),
    ]).toMatchObject([
        { file: 'package.json', rule: 'stale-lockfile' },
        { file: 'packages/app/package.json', rule: 'stale-lockfile' },
    ]);
});

test('stale-lockfile reports a dependency that the pnpm-lock.yaml importer lacks, and no peer dependency', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': JSON.stringify({
            dependencies: { zod: '^4.0.0', react: '^19.0.0' },
            peerDependencies: { vue: '^3.0.0' },
        }),
        'pnpm-lock.yaml':
            "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      zod:\n        specifier: ^4.0.0\n        version: 4.0.5\n",
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings).toMatchObject([{ file: 'package.json', rule: 'stale-lockfile' }]);
    expect(findings[0]?.message).toStartWith(
        'package.json declares react ^19.0.0, which pnpm-lock.yaml does not record.',
    );
});

test('stale-lockfile leaves out a scope that the root lockfile does not hold as a workspace', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'tools', configurations: [] }] }),
        'package.json': '{"workspaces":["packages/*"]}',
        'tools/package.json': '{"name":"tools","dependencies":{"zod":"^4.0.0"}}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{"":{}}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile', { scope: 'tools' })).toStrictEqual([]);
});
