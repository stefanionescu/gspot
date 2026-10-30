import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { generateFiles } from '#cli/generation/generate.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/toml.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writePlans, planManagedKeys } from '#cli/repository/writer.ts';
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

test('a new Bun scanner file has one table and a final newline, and keeps its key with a note after the scanner setting goes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const generated = generateFiles(await openSession(sandbox.path)).managedKeys.find(
        ({ path }) => path === 'bunfig.toml',
    )!;
    const writer = openFiles(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, generated.path, generated.keys)]);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(
        '[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
    );
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['dependencies']));
    const session = await openSession(sandbox.path);
    const report = await writeGeneratedFiles(session, generateFiles(session), writer);
    expect(report.notes).toContain(
        'Keys that gspot no longer manages stay in your files. Review shared config files after removing a configuration.',
    );
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(
        '[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
    );
});
