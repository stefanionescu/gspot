import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';

test('Bun safeguards preserve stricter age and unrelated fields across apply and restoration', async () => {
    await using repository = await testdir();
    const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
    await createFileTree(repository.path, {
        'gspot.toml': policyOf(
            ['dependencies'],
            '[install]\nscanner = "@socketsecurity/bun-security-scanner"\n[guides]\ninstall = false\n',
        ),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
        'bunfig.toml': original,
    });
    const session = await openSession(repository.path);
    const generated = emitted(session).configurations.find((entry) => entry.path === 'bunfig.toml')!;
    const owner = openOwner(repository.path);
    owner.applyPlan(owner.proposeConfiguration(generated.path, generated.format, generated.changes, true));
    const installed = readFileSync(join(repository.path, 'bunfig.toml'), 'utf8');
    expect(Bun.TOML.parse(installed)).toStrictEqual({
        install: {
            exact: true,
            minimumReleaseAge: 1_209_600,
            security: { scanner: '@socketsecurity/bun-security-scanner' },
        },
    });
    expect(installed).toContain('# Authored installation choices');
    expect(owner.applyPlan(owner.proposeConfiguration(generated.path, generated.format, generated.changes, true))).toBe(
        'unchanged',
    );
    expect(owner.applyPlan(owner.proposeRestoration('bunfig.toml'))).toBe('changed');
    owner.close();
    expect(readFileSync(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(original);
});
