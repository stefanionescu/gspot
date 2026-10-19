import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { STALE_LOCKFILE_FILES } from '#tests/data/checks/package-dependencies.ts';

test('stale-lockfile reports each dependency that package.json and bun.lock disagree on', async () => {
    await using sandbox = await testdir({ ...STALE_LOCKFILE_FILES, 'gspot.toml': buildSettingsText(['javascript']) });
    const findings = await checkFindings(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'package.json asks for zod ^4.1.0, but bun.lock records ^4.0.0. Run bun install and commit the lockfile.',
        'package.json declares typescript 5.9.3, which bun.lock does not record. Run bun install and commit the lockfile.',
        'bun.lock records left-pad, which package.json no longer declares. Run bun install and commit the lockfile.',
    ]);
});

test('react-versions reports react and react-dom that lock different versions', async () => {
    await using sandbox = await testdir({ ...STALE_LOCKFILE_FILES, 'gspot.toml': buildSettingsText(['javascript']) });
    const findings = await checkFindings(sandbox.path, 'dependencies/react-versions');
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['react-versions']);
    expect(findings[0]?.message).toStartWith('react 19.1.0 and react-dom 19.0.0 differ');
});

test('package-manager-pin reports a packageManager that names another version than the mise pin', async () => {
    const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@1.4.2' });
    await using sandbox = await testdir({
        'package.json': packageJson,
        'mise.toml': '[tools]\nbun = "1.4.3"\n',
        'gspot.toml': buildSettingsText(['javascript']),
    });
    const mismatched = await checkFindings(sandbox.path, 'dependencies/package-manager-pin');
    expect(mismatched.map(({ message }) => message)).toStrictEqual([
        'packageManager names bun 1.4.2, but mise.toml pins bun 1.4.3. Write one version in both.',
    ]);
    await Bun.write(`${sandbox.path}/package.json`, packageJson.replace('1.4.2', '1.4.3'));
    expect(await checkFindings(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});
