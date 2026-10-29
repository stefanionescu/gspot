import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/toml.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { openWriter, writePlans, planManagedKeys } from '#cli/repository/writer.ts';
import { BUN_SCANNER_KEYS } from '#tests/config/generation/configurations/general/dependencies.ts';

test('a scope that uses Bun gets the scanner that gspot.toml names in its bunfig.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            scopes: [{ path: 'apps/api', configurations: ['dependencies'] }],
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/source.js': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    expect(generateFiles(session).managedKeys.filter((output) => output.path.endsWith('bunfig.toml'))).toStrictEqual([
        ...BUN_SCANNER_KEYS,
    ]);
});

test('a new Bun scanner file has one table and a final newline', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const generated = generateFiles(await openSession(sandbox.path)).managedKeys.find(
        ({ path }) => path === 'bunfig.toml',
    )!;
    using writer = openWriter(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, generated.path, generated.keys)]);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(
        '[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
    );
});
