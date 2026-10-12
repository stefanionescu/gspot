import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { AGE_CASES } from '#tests/config/dependencies.ts';

test.each([...AGE_CASES])('Bun generation sets the required release age with $name bunfig settings', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': settingsText(['dependencies'], {
            tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        ...(entry.source === undefined ? {} : { 'bunfig.toml': entry.source }),
    });
    const session = await openSession(repository.path);
    const generated = emitAll(session).fileEdits.find((output) => output.path === 'bunfig.toml')!;
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
        'gspot.toml': settingsText(['dependencies'], {
            tables: '[[scope]]\npath = "apps/api"\n\nconfigurations = ["dependencies"]\n',
        }),
        [`${prefix}bun.lock`]: '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        [path]: source,
        'apps/api/source.js': 'export const value = 1;\n',
    });
    const session = await openSession(repository.path);
    expect(() => emitAll(session)).toThrow(`${path} is not valid TOML. Fix the file, then run gspot apply.`);
});
