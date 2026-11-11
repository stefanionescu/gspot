import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
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

test('a staged mise.toml alone plans package-manager-pin', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true }),
        'mise.toml': BUN_PIN_SETTINGS,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const session = await openSession(sandbox.path);
    const [planned] = planChecks(session, {
        stage: 'commit',
        selection: { content: 'index', paths: ['mise.toml'] },
        only: ['dependencies/package-manager-pin'],
    });
    expect(planned?.files.map(({ path }) => path)).toContain('mise.toml');
});

test('package-manager-pin gives the line to add beside a pnpm lockfile, with the mise version', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true }),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'mise.toml': '[tools]\npnpm = "10.30.0"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'CI installs only a pinned pnpm. Add "packageManager": "pnpm@10.30.0" to package.json.',
    ]);
});

test('package-manager-pin names no mise range in the line to add, because a packageManager field needs an exact version', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true }),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'mise.toml': '[tools]\npnpm = "10"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'CI installs only a pinned pnpm. Add "packageManager": "pnpm@<version>" to package.json.',
    ]);
});

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
