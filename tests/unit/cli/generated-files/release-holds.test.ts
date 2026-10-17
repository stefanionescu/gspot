import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { planRemoval, planManagedKeys } from '#cli/ownership/plans.ts';

import {
    AGE_CASES,
    HOLD_CASES,
    TOKEN_NPMRC,
    OWN_PACKAGES,
    PNPM_WORKSPACE,
    YARN_CLASSIC_LOCKFILE,
} from '#tests/data/checks/dependencies.ts';

test.each([...HOLD_CASES])('a scope that uses $installer gets the seven-day hold in $path', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': buildSettingsText(['dependencies']), ...entry.files });
    const session = await openSession(repository.path);
    const found: unknown = generate(session).fileEdits.filter((output) => output.path === entry.path);
    expect(found).toStrictEqual([{ path: entry.path, changes: entry.changes }]);
});

test('a Yarn 1 lockfile gets no hold, because Yarn 1 has none', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies']),
        'yarn.lock': YARN_CLASSIC_LOCKFILE,
    });
    const session = await openSession(repository.path);
    expect(generate(session).fileEdits.map((output) => output.path)).not.toContain('.yarnrc.yml');
});

test.each([...AGE_CASES])('Bun keeps a longer hold and sets the scanner with $name bunfig settings', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies'], {
            tables: '[dependencies]\nbun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        ...(entry.source === undefined ? {} : { 'bunfig.toml': entry.source }),
    });
    const session = await openSession(repository.path);
    const generated = generate(session).fileEdits.find((output) => output.path === 'bunfig.toml')!;
    expect(generated.changes).toStrictEqual([
        { path: ['install', 'minimumReleaseAge'], value: entry.expected },
        { path: ['install', 'minimumReleaseAgeExcludes'], value: [...OWN_PACKAGES] },
        { path: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' },
    ]);
});

test('npm in a scope keeps a longer hold, your own excludes, and the token line', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["dependencies"]\n',
        }),
        'apps/api/package-lock.json': '{"lockfileVersion":3,"packages":{}}',
        'apps/api/.npmrc': TOKEN_NPMRC,
    });
    const session = await openSession(repository.path);
    const generated = generate(session).fileEdits.find((output) => output.path === 'apps/api/.npmrc')!;
    expect(generated.changes).toStrictEqual([
        { path: ['min-release-age'], value: '14' },
        { path: ['min-release-age-exclude'], value: ['@acme/tools', ...OWN_PACKAGES] },
    ]);
    using log = openWriter(repository.path);
    writePlans(log, [planManagedKeys(log, generated.path, generated.changes)]);
    const excludes = ['@acme/tools', ...OWN_PACKAGES].map((name) => `min-release-age-exclude[]=${name}\n`).join('');
    const token = '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n';
    expect(await readFile(join(repository.path, 'apps/api/.npmrc'), 'utf8')).toBe(
        `min-release-age=14\n${excludes}${token}`,
    );
});

test('pnpm keeps the comments and packages of pnpm-workspace.yaml, and the hold stays when management stops', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies']),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'pnpm-workspace.yaml': PNPM_WORKSPACE,
    });
    const session = await openSession(repository.path);
    const generated = generate(session).fileEdits.find((output) => output.path === 'pnpm-workspace.yaml')!;
    using log = openWriter(repository.path);
    writePlans(log, [planManagedKeys(log, generated.path, generated.changes)]);
    const written = await readFile(join(repository.path, 'pnpm-workspace.yaml'), 'utf8');
    expect(written).toStartWith(PNPM_WORKSPACE);
    expect(Bun.YAML.parse(written)).toStrictEqual({
        packages: ['apps/*'],
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: [...OWN_PACKAGES],
    });
    writePlans(log, [planRemoval(log, 'pnpm-workspace.yaml')]);
    expect(await readFile(join(repository.path, 'pnpm-workspace.yaml'), 'utf8')).toBe(written);
});

test('generation names a malformed pnpm-workspace.yaml', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies']),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'pnpm-workspace.yaml': 'packages: [\n',
    });
    const session = await openSession(repository.path);
    expect(() => generate(session)).toThrow(
        'pnpm-workspace.yaml is not valid YAML. Fix the file, then run gspot apply.',
    );
});

test.each(['', 'apps/api/'])('Bun generation names a malformed %sbunfig.toml', async (prefix) => {
    await using repository = await testdir();
    const source = '[install\n';
    const path = `${prefix}bunfig.toml`;
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies'], {
            tables: '[[scope]]\npath = "apps/api"\n\nconfigurations = ["dependencies"]\n',
        }),
        [`${prefix}bun.lock`]: '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        [path]: source,
        'apps/api/source.js': 'export const value = 1;\n',
    });
    const session = await openSession(repository.path);
    expect(() => generate(session)).toThrow(`${path} is not valid TOML. Fix the file, then run gspot apply.`);
});
