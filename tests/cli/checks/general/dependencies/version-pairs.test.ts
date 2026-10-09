import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { versionPairs } from '#cli/checks/general/dependencies/public.ts';
import { VERSION_PAIR_CASES } from '#tests/config/cli/checks/general/dependencies/version-pairs.ts';
import { NEXT_VERSION_PAIRS, REACT_VERSION_PAIRS } from '#cli/config/checks/general/dependencies.ts';

for (const configuration of ['react', 'nextjs'])
    for (const scope of ['', 'app'])
        test.each(VERSION_PAIR_CASES)(`${configuration} at ${scope || 'the root'}: $name`, async (row) => {
            await using sandbox = await testdir();
            const pairs = configuration === 'react' ? REACT_VERSION_PAIRS : NEXT_VERSION_PAIRS;
            const [left, right] = pairs[0]!;
            const files = {
                'gspot.toml': buildPolicy(scope === '' ? [configuration] : ['javascript'], {
                    tables: scope === '' ? '' : `[scope.app]\nconfigurations = ["${configuration}"]\n`,
                }),
                [join(scope, 'package.json')]: JSON.stringify({
                    private: true,
                    dependencies: { [left]: row.left, [right]: row.right },
                }),
                ...(row.installedLeft === undefined
                    ? {}
                    : {
                          [join(scope, 'node_modules', left, 'package.json')]: JSON.stringify({
                              name: left,
                              version: row.installedLeft,
                          }),
                      }),
                ...(row.installedRight === undefined
                    ? {}
                    : {
                          [join(scope, 'node_modules', right, 'package.json')]: JSON.stringify({
                              name: right,
                              version: row.installedRight,
                          }),
                      }),
            };
            await createFileTree(sandbox.path, files);
            const session = await openSession(sandbox.path);
            const check = `${configuration}/version-pairs`;
            const input = buildCheckInput(session, check, {
                scope,
                paths: [join(scope, 'package.json').replaceAll('/', '\\')],
            });
            const found = versionPairs(input, pairs);
            expect(found).toHaveLength(row.findings);
            if (row.findings === 1) {
                expect(found[0]).toMatchObject({
                    check,
                    file: posix.join(scope, 'package.json'),
                    line: 1,
                    rule: 'version-pair',
                });
                expect(found[0]!.message).toContain(row.installedLeft);
                expect(found[0]!.message).toContain(row.installedRight);
            }
            expect(
                session.scopes
                    .find(({ scope: selected }) => selected.path === scope)
                    ?.selected.some(({ configuration: selected }) => selected.name === 'nextjs'),
            ).toBe(configuration === 'nextjs');
        });

test('a child React project compares its hoisted installed packages', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { tables: '[scope.app]\nconfigurations = ["react"]\n' }),
        'app/package.json': '{"dependencies":{"react":"*","react-dom":"*"}}',
        'node_modules/react/package.json': '{"name":"react","version":"19.1.1"}',
        'node_modules/react-dom/package.json': '{"name":"react-dom","version":"19.1.0"}',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'react/version-pairs', {
        scope: 'app',
        paths: ['app/package.json'],
    });
    expect(versionPairs(input, REACT_VERSION_PAIRS)).toMatchObject([
        { file: 'app/package.json', rule: 'version-pair' },
    ]);
});

test.each(['react', 'nextjs'])(
    '%s dispatches its own installed pair through the public check command',
    async (configuration) => {
        await using sandbox = await testdir();
        const [left, right] = (configuration === 'react' ? REACT_VERSION_PAIRS : NEXT_VERSION_PAIRS)[0]!;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([configuration]),
            'package.json': JSON.stringify({
                private: true,
                packageManager: 'bun@1.4.2',
                dependencies: { [left]: '*', [right]: '*' },
            }),
            [join('node_modules', left, 'package.json')]: JSON.stringify({ name: left, version: '19.1.1' }),
            [join('node_modules', right, 'package.json')]: JSON.stringify({ name: right, version: '19.1.0' }),
        });
        const result = await checkReport(sandbox.path, ['check', '--only', `${configuration}/version-pairs`, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = result.report;
        expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { check: `${configuration}/version-pairs`, file: 'package.json', line: 1, rule: 'version-pair' },
        ]);
    },
);
