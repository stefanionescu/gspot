import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { planManagedKeys, writePlans } from '#cli/repository/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { BUN_SCANNER_KEYS } from '#tests/config/configurations/dependencies.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a scope that uses Bun gets the scanner that gspot.toml names in its bunfig.toml', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            scopes: [{ path: 'apps/api', configurations: ['dependencies'] }],
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/source.js': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    expect(
        buildGeneratedFiles(session).managedKeys.filter((output) => output.path.endsWith('bunfig.toml')),
    ).toStrictEqual([...BUN_SCANNER_KEYS]);
});

test('a new Bun scanner file has one table and a final newline', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const generated = buildGeneratedFiles(await openSession(sandbox.path)).managedKeys.find(
        ({ path }) => path === 'bunfig.toml',
    )!;
    const writer = openFiles(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, generated.path, generated.keys)]);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(
        '[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
    );
});
