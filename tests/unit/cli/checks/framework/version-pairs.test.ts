import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { VERSION_PAIR_CASES } from '#tests/config/react.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { versionPairs } from '#cli/checks/framework/version-pairs.ts';
import { NEXT_VERSION_PAIRS, REACT_VERSION_PAIRS } from '#cli/config/checks/framework/version-pairs.ts';

const scope = '';
const configuration = 'react';
test.each([...VERSION_PAIR_CASES])('$name', async (row) => {
    await using sandbox = await testdir();
    const pairs = REACT_VERSION_PAIRS;
    const [left, right] = pairs[0];
    const files = {
        'gspot.toml': settingsText([configuration]),
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
        paths: [join(scope, 'package.json')],
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
        expect(found[0]!.message).toBe(
            `${left} is ${row.installedLeft} and ${right} is ${row.installedRight}. Move ${left} and ${right} to the same version.`,
        );
    }
});

test('a child React project compares its hoisted installed packages', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], { tables: '[[scope]]\npath = "app"\nconfigurations = ["react"]\n' }),
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
    '%s/version-pairs reports different installed versions through gspot check',
    async (configuration) => {
        await using sandbox = await testdir();
        const [left, right] = (configuration === 'react' ? REACT_VERSION_PAIRS : NEXT_VERSION_PAIRS)[0];
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([configuration]),
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
