import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import { DEPENDENCY_CASES } from '#tests/config/cli/planning/dependencies.ts';
import { detectConfigurations } from '#cli/repository/selection/contracts.ts';

for (const level of ['recommended', 'all'] as const)
    test.each(DEPENDENCY_CASES)(
        `next-intl dependency condition at ${level}: $name`,
        async ({ scope, files, selected }) => {
            await using sandbox = await testdir({
                ...files,
                'gspot.toml': buildPolicy(['translations'], {
                    level,
                    tables: '[scope.app]\n[scope."app/deep"]\n[scope.sibling]\n',
                }),
                'source.ts': 'export {};\n',
                'app/source.ts': 'export {};\n',
                'app/deep/source.ts': 'export {};\n',
                'sibling/source.ts': 'export {};\n',
            });
            const session = await openSession(sandbox.path);
            const planned = planRun(session, { stage: 'push', skips: [], only: ['translations/locales'] });
            const check = planned.find((entry) => entry.scope.scope.path === scope)!;
            expect(check.skip).toStrictEqual(
                selected ? undefined : { cause: 'condition', note: 'Needs a project dependency: next-intl.' },
            );
        },
    );

test('checks without dependency conditions do not inspect unused malformed manifests', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy([]),
        'package.json': '{"private":true}\n',
        'source.toml': 'key = true\n',
    });
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, 'package.json'), '{not-json}\n');
    const checks = planRun(session, { stage: 'commit', skips: [], only: ['files/taplo'] });
    expect(checks.map((check) => check.skip)).toStrictEqual([undefined]);
});

test.each(['next-intl', 'react-i18next'])(
    'translations detection finds %s without a Next.js suggestion',
    async (dependency) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy([]),
            'package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '4.8.3' } }),
            'source.ts': 'export {};\n',
        });
        const session = await openSession(sandbox.path);
        const detected = detectConfigurations(
            session.root,
            session.repository.files,
            session.manifests,
            readPackageManifests(session.root, session.repository.files),
        );
        expect(detected.some((entry) => entry.configuration === 'translations')).toBe(true);
        expect(detected.some((entry) => entry.configuration === 'nextjs')).toBe(false);
    },
);
