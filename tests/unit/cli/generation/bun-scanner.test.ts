import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { planManagedKeys } from '#cli/ownership/plans.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { INSTALLER_FILES } from '#tests/data/checks/dependencies.ts';

test.each([...INSTALLER_FILES])('a scope that uses $installer gets no release hold in $path', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': buildSettingsText(['dependencies']), ...entry.files });
    const session = await openSession(repository.path);
    expect(generate(session).fileEdits.filter((output) => output.path === entry.path)).toStrictEqual([]);
});

test('a scope that uses Bun gets the scanner that gspot.toml names in its bunfig.toml', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["dependencies"]\ndependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'apps/api/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/source.js': 'export const value = 1;\n',
    });
    const session = await openSession(repository.path);
    expect(generate(session).fileEdits.filter((output) => output.path.endsWith('bunfig.toml'))).toStrictEqual([
        {
            path: 'apps/api/bunfig.toml',
            changes: [{ path: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
        },
    ]);
});

test('a malformed bunfig.toml that the scanner goes into is named when gspot writes it', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies'], {
            tables: '[dependencies]\nbun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': '[install\n',
    });
    const session = await openSession(repository.path);
    const edit = generate(session).fileEdits.find((output) => output.path === 'bunfig.toml')!;
    using log = openWriter(repository.path);
    expect(() => planManagedKeys(log, edit.path, edit.changes)).toThrow('bunfig.toml is not valid TOML.');
});
