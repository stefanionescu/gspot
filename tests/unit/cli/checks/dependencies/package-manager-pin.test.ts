import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { MISE_PIN_FILES } from '#tests/data/checks/dependencies.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('package-manager-pin reports a packageManager that names another version than the mise pin', async () => {
    const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@1.4.2' });
    await using sandbox = await testdir({
        'package.json': packageJson,
        'mise.toml': '[tools]\nbun = "1.4.3"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const mismatched = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(mismatched.map(({ message }) => message)).toStrictEqual([
        'packageManager names bun 1.4.2, but mise.toml pins bun 1.4.3. Write one version in both.',
    ]);
    await writeFile(`${sandbox.path}/package.json`, packageJson.replace('1.4.2', '1.4.3'));
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});
test.each([...MISE_PIN_FILES])('package-manager-pin reads the bun pin from $file', async ({ file }) => {
    await using sandbox = await testdir({
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        [file]: '[tools]\nbun = "0.0.0-test.2"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'package.json',
            line: 1,
            rule: 'package-manager-pin',
            message: `packageManager names bun 0.0.0-test.1, but ${file} pins bun 0.0.0-test.2. Write one version in both.`,
        },
    ]);
});
test('package-manager-pin uses the highest-precedence mise file in a folder', async () => {
    await using sandbox = await testdir({
        ...Object.fromEntries(MISE_PIN_FILES.map(({ file }) => [file, '[tools]\nbun = "0.0.0-test.2"\n'])),
        '.mise.local.toml': '[tools]\nbun = "0.0.0-test.1"\n',
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});
