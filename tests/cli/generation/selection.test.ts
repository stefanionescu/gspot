import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import type { LicenseAllowlist } from '#cli/types/checks/general/licenses.ts';

test('security output follows the selected security configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': 'echo sample\n',
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = emitAll(plainSession);
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = emitAll(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toContain('rules:');
});

test.each(['recommended', 'all'])('generated %s ESLint configuration makes layout opt-in', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: level }),
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const config = output.files.find((file) => file.path === '.gspot/config/eslint.config.mjs');
    expect(config).toBeDefined();
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(sandbox.path, '.gspot/config/eslint.config.mjs'), config!.content);
    const eslint = new ESLint({
        cwd: sandbox.path,
        overrideConfigFile: join(sandbox.path, '.gspot/config/eslint.config.mjs'),
    });
    const [result] = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', {
        filePath: 'src/order.js',
    });
    expect(result?.fatalErrorCount).toBe(0);
    const layout = result!.messages.filter((diagnostic) => diagnostic.ruleId === 'gspot/private-before-public');
    // The layout rule belongs to the all level alone.
    expect(layout).toMatchObject(level === 'recommended' ? [] : [{ ruleId: 'gspot/private-before-public', line: 2 }]);
});

test('license configuration retains scoped exceptions and inherited license allowances', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}',
        'app/pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
        'app/child/pyproject.toml': '[project]\nname = "child"\nversion = "1.0.0"\n',
        'sibling/pyproject.toml': '[project]\nname = "sibling"\nversion = "1.0.0"\n',
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml': buildPolicy(['licenses'], {
            tables: '[licenses]\nallowed = ["MPL-2.0"]\n[[scope]]\npath = "app"\n[[scope.licenses.exceptions]]\npackage = "example@1.2.3"\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session).files.filter(({ path }) => path.endsWith('/licenses.json'));
    const parsed = new Map(configs.map(({ path, content }) => [path, JSON.parse(content) as LicenseAllowlist]));
    expect(parsed.size).toBe(4);
    for (const path of [
        '.gspot/config/licenses.json',
        '.gspot/config/app/licenses.json',
        '.gspot/config/app/child/licenses.json',
        '.gspot/config/sibling/licenses.json',
    ])
        expect(parsed.get(path)!.allowed).toContain('MPL-2.0');
    for (const path of ['.gspot/config/app/licenses.json', '.gspot/config/app/child/licenses.json'])
        expect(parsed.get(path)!.exceptions).toStrictEqual([
            { package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed installed metadata.' },
        ]);
    for (const path of ['.gspot/config/licenses.json', '.gspot/config/sibling/licenses.json'])
        expect(parsed.get(path)!.exceptions).toStrictEqual([]);
});
