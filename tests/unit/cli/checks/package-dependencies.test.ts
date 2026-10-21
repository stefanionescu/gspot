import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { MISE_PIN_FILES } from '#tests/data/checks/dependencies.ts';
import { STALE_LOCKFILE_FILES } from '#tests/data/checks/package-dependencies.ts';

test('stale-lockfile reports each dependency that package.json and bun.lock disagree on', async () => {
    await using sandbox = await testdir({
        ...STALE_LOCKFILE_FILES,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await checkFindings(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'package.json asks for zod ^4.1.0, but bun.lock records ^4.0.0. Run bun install and commit the lockfile.',
        'package.json declares typescript 5.9.3, which bun.lock does not record. Run bun install and commit the lockfile.',
        'bun.lock records left-pad, which package.json no longer declares. Run bun install and commit the lockfile.',
    ]);
});

test('react-versions reports react and react-dom that lock different versions', async () => {
    await using sandbox = await testdir({
        ...STALE_LOCKFILE_FILES,
        'gspot.toml': buildSandboxSettings(['react-dom']),
    });
    const findings = await checkFindings(sandbox.path, 'react-dom/react-versions');
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['react-versions']);
    expect(findings[0]?.message).toStartWith('react 19.1.0 and react-dom 19.0.0 differ');
});

test('package-manager-pin reports a packageManager that names another version than the mise pin', async () => {
    const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@1.4.2' });
    await using sandbox = await testdir({
        'package.json': packageJson,
        'mise.toml': '[tools]\nbun = "1.4.3"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const mismatched = await checkFindings(sandbox.path, 'dependencies/package-manager-pin');
    expect(mismatched.map(({ message }) => message)).toStrictEqual([
        'packageManager names bun 1.4.2, but mise.toml pins bun 1.4.3. Write one version in both.',
    ]);
    await writeFile(`${sandbox.path}/package.json`, packageJson.replace('1.4.2', '1.4.3'));
    expect(await checkFindings(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});

test.each([...MISE_PIN_FILES])('package-manager-pin reads the bun pin from $file', async ({ file }) => {
    await using sandbox = await testdir({
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        [file]: '[tools]\nbun = "0.0.0-test.2"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await checkFindings(sandbox.path, 'dependencies/package-manager-pin');
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
    expect(await checkFindings(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});
