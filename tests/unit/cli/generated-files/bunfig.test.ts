import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { AGE_CASES } from '#tests/data/checks/dependencies.ts';

test.each([...AGE_CASES])('Bun generation sets the required release age with $name bunfig settings', async (entry) => {
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
        { path: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' },
    ]);
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
