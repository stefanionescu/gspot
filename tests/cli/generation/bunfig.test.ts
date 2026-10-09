import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { planMerge, planRestoration } from '#cli/lifecycle/ownership/contracts.ts';
import { AGE_CASES, TWO_WEEKS_SECONDS } from '#tests/config/cli/generation/bunfig.ts';

test('Bun safeguards preserve stricter age and unrelated fields across ownership merge and restoration', async () => {
    await using repository = await testdir();
    const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['dependencies'], {
            tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': original,
    });
    const session = await openSession(repository.path);
    const generated = emitAll(session).toolFiles.find((entry) => entry.path === 'bunfig.toml')!;
    const log = openOwnership(repository.path);
    applyPlans(log, [planMerge(log, generated.path, generated.changes, true)]);
    const installed = await readFile(join(repository.path, 'bunfig.toml'), 'utf8');
    expect(Bun.TOML.parse(installed)).toStrictEqual({
        install: {
            exact: true,
            minimumReleaseAge: TWO_WEEKS_SECONDS,
            security: { scanner: '@socketsecurity/bun-security-scanner' },
        },
    });
    expect(installed).toContain('# Authored installation choices');
    expect(applyPlans(log, [planMerge(log, generated.path, generated.changes, true)])[0]).toBe('unchanged');
    expect(applyPlans(log, [planRestoration(log, 'bunfig.toml')])[0]).toBe('changed');
    log[Symbol.dispose]();
    expect(await readFile(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(original);
});

test.each([...AGE_CASES])('Bun generation sets the required age with $name authored settings', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['dependencies'], {
            tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        ...(entry.source === undefined ? {} : { 'bunfig.toml': entry.source }),
    });
    const session = await openSession(repository.path);
    const generated = emitAll(session).toolFiles.find((output) => output.path === 'bunfig.toml')!;
    expect(generated.changes).toStrictEqual([
        { path: ['install', 'minimumReleaseAge'], value: entry.expected },
        { path: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' },
    ]);
});

test.each(['', 'apps/api/'])(
    'Bun generation names malformed %sbunfig.toml and preserves authored bytes',
    async (prefix) => {
        await using repository = await testdir();
        const source = '[install\n';
        const path = `${prefix}bunfig.toml`;
        await createFileTree(repository.path, {
            'gspot.toml': buildPolicy(['dependencies'], {
                tables: '[scope."apps/api"]\nconfigurations = ["dependencies"]\n',
            }),
            [`${prefix}bun.lock`]: '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
            [path]: source,
            'apps/api/source.js': 'export const value = 1;\n',
        });
        const session = await openSession(repository.path);
        expect(() => emitAll(session)).toThrow(`${path} is not valid TOML. Fix the file, then run gspot apply.`);
        expect(await readFile(join(repository.path, path), 'utf8')).toBe(source);
    },
);
