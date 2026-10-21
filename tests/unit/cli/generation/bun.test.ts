import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { planSettingsWrite } from '#cli/ownership/file-settings.ts';

test('a scope that uses Bun gets the scanner that gspot.toml names in its bunfig.toml', async () => {
    await using repository = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            scopes: [{ path: 'apps/api', configurations: ['dependencies'] }],
            tables: 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/source.js': 'export const value = 1;\n',
    });

    const session = await openSession(repository.path);
    expect(generate(session).fileSettings.filter((output) => output.path.endsWith('bunfig.toml'))).toStrictEqual([
        {
            path: 'apps/api/bunfig.toml',
            changes: [{ path: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
        },
    ]);
});

test('a malformed bunfig.toml that the scanner goes into is named when gspot writes it', async () => {
    await using repository = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            tables: '[dependencies]\nbun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': '[install\n',
    });

    const session = await openSession(repository.path);
    const edit = generate(session).fileSettings.find((output) => output.path === 'bunfig.toml')!;
    using log = openWriter(repository.path);
    expect(() => planSettingsWrite(log, edit.path, edit.changes)).toThrow(
        'bunfig.toml:1:9 is not valid TOML: Error parsing TOML (1, 9):. Fix the file.',
    );
});
