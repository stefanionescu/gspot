import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { proposeMerge } from '#cli/lifecycle/ownership/plans.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { AGE_CASES, TWO_WEEKS_SECONDS } from '#tests/config/cli/generation/bunfig.ts';

test('Bun safeguards preserve stricter age and unrelated fields across ownership merge and restoration', async () => {
    await using repository = await testdir();
    const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['dependencies'], {
            tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n[agent_rules]\nenabled = false\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': original,
    });
    const session = await openSession(repository.path);
    const generated = emitAll(session).configurations.find((entry) => entry.path === 'bunfig.toml')!;
    const log = openOwnership(repository.path);
    applyPlan(log, proposeMerge(log, generated.path, generated.changes, true));
    const installed = readFileSync(join(repository.path, 'bunfig.toml'), 'utf8');
    expect(Bun.TOML.parse(installed)).toStrictEqual({
        install: {
            exact: true,
            minimumReleaseAge: TWO_WEEKS_SECONDS,
            security: { scanner: '@socketsecurity/bun-security-scanner' },
        },
    });
    expect(installed).toContain('# Authored installation choices');
    expect(applyPlan(log, proposeMerge(log, generated.path, generated.changes, true))).toBe('unchanged');
    expect(applyPlan(log, proposeRestoration(log, 'bunfig.toml'))).toBe('changed');
    log[Symbol.dispose]();
    expect(readFileSync(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(original);
});

test.each([...AGE_CASES])('Bun generation sets the required age with $name authored settings', async (entry) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['dependencies'], {
            tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n[agent_rules]\nenabled = false\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        ...(entry.source === undefined ? {} : { 'bunfig.toml': entry.source }),
    });
    const session = await openSession(repository.path);
    const generated = emitAll(session).configurations.find((output) => output.path === 'bunfig.toml')!;
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
                tables: '[agent_rules]\nenabled = false\n[[scope]]\npath = "apps/api"\nconfigurations = ["dependencies"]\n',
            }),
            [`${prefix}bun.lock`]: '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
            [path]: source,
            'apps/api/source.js': 'export const value = 1;\n',
        });
        const session = await openSession(repository.path);
        expect(() => emitAll(session)).toThrow(`${path} is not valid TOML. Fix the file, then run gspot apply.`);
        expect(readFileSync(join(repository.path, path), 'utf8')).toBe(source);
    },
);
