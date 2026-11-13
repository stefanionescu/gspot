import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { BUN_PIN_SETTINGS } from '#tests/config/configurations/dependencies.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('package-manager-pin reports a packageManager that differs from the bun pin of mise.toml, and passes once they match', async () => {
    const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' });
    await using sandbox = await createGitSandbox({
        'package.json': packageJson,
        'mise.toml': BUN_PIN_SETTINGS,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'package.json',
            line: 1,
            rule: 'package-manager-pin',
            message: expect.stringMatching(/\b0\.0\.0-test\.1\b.+\b0\.0\.0-test\.2\b/u) as string,
        },
    ]);
    await writeFile(join(sandbox.path, 'package.json'), packageJson.replace('test.1', 'test.2'));
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});

test.each([
    ['10.30.0', 'pnpm@10.30.0'],
    ['10', 'pnpm@<version>'],
])(
    'package-manager-pin names the exact mise pin, or a placeholder for a range, in the line to add: %s',
    async (pin, expected) => {
        await using sandbox = await createGitSandbox({
            'package.json': JSON.stringify({ name: 'shop', private: true }),
            'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
            'mise.toml': `[tools]\npnpm = "${pin}"\n`,
            'gspot.toml': buildSandboxSettings(['javascript']),
        });
        const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
        expect(findings.map(({ message }) => message)).toStrictEqual([
            expect.stringContaining(`"packageManager": "${expected}"`) as string,
        ]);
    },
);

test('package-manager-pin uses the highest-precedence mise file in a folder', async () => {
    await using sandbox = await createGitSandbox({
        'mise.toml': BUN_PIN_SETTINGS,
        '.mise.local.toml': '[tools]\nbun = "0.0.0-test.1"\n',
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});

test('package-manager-pin reports malformed mise syntax and still reads other mise files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"packageManager":"bun@1.0.0"}',
        'mise.toml': '[tools',
        '.mise.toml': '[tools]\nbun = "2.0.0"\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'mise.toml', rule: 'syntax' },
        { file: 'package.json', rule: 'package-manager-pin' },
    ]);
});

test.each([
    { form: 'npm:<tool>', tools: '"npm:bun" = "0.0.0-test.2"' },
    { form: 'an array', tools: 'bun = ["0.0.0-test.2"]' },
    { form: 'a { version } table', tools: 'bun = { version = "0.0.0-test.2" }' },
])('package-manager-pin reads the mise pin written as $form', async ({ tools }) => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'mise.toml': `[tools]\n${tools}\n`,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'package.json', rule: 'package-manager-pin' },
    ]);
});
