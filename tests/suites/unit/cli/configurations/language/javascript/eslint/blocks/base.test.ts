import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('the pin rule pins every range of a private package and only the dev dependencies of a published one', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': `${JSON.stringify(
            { name: 'app', private: true, type: 'module', dependencies: { 'left-pad': '^1.3.0' } },
            null,
            4,
        )}\n`,
        'packages/lib/package.json': `${JSON.stringify(
            {
                name: 'lib',
                version: '1.0.0',
                type: 'module',
                dependencies: { 'left-pad': '^1.3.0' },
                devDependencies: { 'right-pad': '^1.0.0' },
            },
            null,
            4,
        )}\n`,
        'source.js': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(
        eslint,
        sandbox.path,
        ['package.json', 'packages/lib/package.json'],
        ['package-json/restrict-dependency-ranges'],
    );
    expect(findings).toStrictEqual([
        { file: 'package.json', rule: 'package-json/restrict-dependency-ranges', line: 6 },
        { file: 'packages/lib/package.json', rule: 'package-json/restrict-dependency-ranges', line: 9 },
    ]);
});

test.each([...LEVELS])('%s runs each gspot rule of its level in JavaScript and TypeScript files', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true,"jsx":"preserve"},"include":["view.tsx"]}\n',
        'source.js': '',
        'view.tsx': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const levels = new Set(level === 'all' ? ['recommended', 'all'] : ['recommended']);
    const expected = Object.fromEntries(
        Object.entries(plugin.rules)
            .filter(([, rule]) => rule.meta.docs?.level !== 'none')
            .map(([name, rule]): [string, number] => [
                `gspot/${name}`,
                levels.has(rule.meta.docs?.level ?? 'none') ? 2 : 0,
            ]),
    );
    for (const [file, table] of Object.entries(await readEslintRules(eslint, ['source.js', 'view.tsx'])))
        expect(
            Object.fromEntries(Object.keys(expected).map((name): [string, number] => [name, table[name]?.[0] ?? 0])),
            file,
        ).toStrictEqual(expected);
});

test('the gspot security and table rules report their cases through the generated config', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"noEmit":true,"jsx":"preserve","lib":["ES2022","DOM"]},"include":["view.tsx"]}\n',
        'source.js': [
            "import crypto from 'node:crypto';",
            "import * as s3 from 'aws-cdk-lib/aws-s3';",
            "export const cipher = crypto.createCipheriv('des-cbc', key, iv);",
            "export const bucket = new s3.Bucket(scope, 'Assets', { enforceSSL: true, versioned: true });",
            "export const server = '10.0.12.4';",
            "export const api = 'ftp://files.acme.io';",
            "export const safe = crypto.createCipheriv('aes-256-gcm', key, iv);",
            '',
        ].join('\n'),
        'view.tsx': [
            'export const table = <table><tr><td>Name</td></tr></table>;',
            "export function send(data: unknown) { window.postMessage(data, '*'); }",
            '',
        ].join('\n'),
    });

    const eslint = await buildEslint(sandbox.path);
    const rules = [
        'gspot/no-weak-cipher',
        'gspot/encryption-secure-mode',
        'gspot/aws-insecure-bucket-transport',
        'gspot/no-hardcoded-ip',
        'gspot/no-clear-text-protocols',
        'gspot/table-header',
        'gspot/post-message',
    ];
    expect(await listLintFindings(eslint, sandbox.path, ['source.js', 'view.tsx'], rules)).toStrictEqual([
        { file: 'source.js', rule: 'gspot/encryption-secure-mode', line: 3 },
        { file: 'source.js', rule: 'gspot/no-weak-cipher', line: 3 },
        { file: 'source.js', rule: 'gspot/no-hardcoded-ip', line: 5 },
        { file: 'source.js', rule: 'gspot/no-clear-text-protocols', line: 6 },
        { file: 'view.tsx', rule: 'gspot/table-header', line: 1 },
        { file: 'view.tsx', rule: 'gspot/post-message', line: 2 },
    ]);
});
