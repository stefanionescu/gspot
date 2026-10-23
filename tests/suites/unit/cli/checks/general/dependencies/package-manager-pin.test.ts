import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MISE_PIN_FILES } from '#tests/config/checks/general/dependencies.ts';

test.each([...MISE_PIN_FILES])(
    'package-manager-pin reports a packageManager that differs from the bun pin of $file, and passes once they match',
    async ({ file }) => {
        const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' });
        await using sandbox = await testdir({
            'package.json': packageJson,
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
        await writeFile(join(sandbox.path, 'package.json'), packageJson.replace('test.1', 'test.2'));
        expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
    },
);
test('package-manager-pin uses the highest-precedence mise file in a folder', async () => {
    await using sandbox = await testdir({
        ...Object.fromEntries(MISE_PIN_FILES.map(({ file }) => [file, '[tools]\nbun = "0.0.0-test.2"\n'])),
        '.mise.local.toml': '[tools]\nbun = "0.0.0-test.1"\n',
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});
