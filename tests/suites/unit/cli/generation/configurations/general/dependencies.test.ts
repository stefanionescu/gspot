import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { planRemoval } from '#cli/apply/write/plans.ts';
import { openWriter, writePlans } from '#cli/apply/write/writer.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { planSettingsWrite } from '#cli/apply/write/managed-keys.ts';
import { BUN_SCANNER_KEYS, TWO_WEEKS_SECONDS } from '#tests/config/generation/configurations/general/dependencies.ts';

test('a scope that uses Bun gets the scanner that gspot.toml names in its bunfig.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            scopes: [{ path: 'apps/api', configurations: ['dependencies'] }],
            tables: 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'apps/api/source.js': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    expect(generate(session).managedKeys.filter((output) => output.path.endsWith('bunfig.toml'))).toStrictEqual([
        ...BUN_SCANNER_KEYS,
    ]);
});

test('the Bun scanner key keeps your own bunfig.toml fields when management stops', async () => {
    await using sandbox = await testdir();
    const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            tables: '[dependencies]\nbun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': original,
    });
    const session = await openSession(sandbox.path);
    const generated = generate(session).managedKeys.find((managedKey) => managedKey.path === 'bunfig.toml')!;
    using writer = openWriter(sandbox.path);
    writePlans(writer, [planSettingsWrite(writer, generated.path, generated.keys)]);
    const installed = await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8');
    expect(Bun.TOML.parse(installed)).toStrictEqual({
        install: {
            exact: true,
            minimumReleaseAge: TWO_WEEKS_SECONDS,
            security: { scanner: '@socketsecurity/bun-security-scanner' },
        },
    });
    expect(installed).toContain('# Authored installation choices');
    writePlans(writer, [planSettingsWrite(writer, generated.path, generated.keys)]);
    writePlans(writer, [planRemoval(writer, 'bunfig.toml')]);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(installed);
});
