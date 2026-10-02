import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';

test('security output follows the selected security configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash']),
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = emitAll(plainSession.policyFiles.policy, plainSession.repository, plainSession.scopes, {
        version: plainSession.version,
        packageClient: plainSession.packageClient,
    });
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policyOf(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = emitAll(
        securitySession.policyFiles.policy,
        securitySession.repository,
        securitySession.scopes,
        { version: securitySession.version, packageClient: securitySession.packageClient },
    );
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toContain('rules:');
});

test.each(['recommended', 'all'])('generated %s ESLint configuration makes layout opt-in', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['typescript'], '', level),
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    symlinkSync(
        fileURLToPath(new URL('../../../../node_modules', import.meta.url)),
        join(sandbox.path, 'node_modules'),
        'dir',
    );
    const session = await openSession(sandbox.path);
    const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
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
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml': policyOf(
            ['licenses'],
            '[tools.licenses]\nlicenses_allowed = ["MPL-2.0"]\n[[scope]]\npath = "app"\n[[scope.tools.licenses.packages_allowed]]\npackage = "example@1.2.3"\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
        ),
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/licenses.json'));
    const parsed = new Map(
        configs.map(({ path, content }) => [
            path,
            JSON.parse(content) as { licenses_allowed: string[]; packages_allowed: unknown[] },
        ]),
    );
    expect(parsed.size).toBe(4);
    for (const path of [
        '.gspot/config/licenses.json',
        '.gspot/config/app/licenses.json',
        '.gspot/config/app/child/licenses.json',
        '.gspot/config/sibling/licenses.json',
    ])
        expect(parsed.get(path)!.licenses_allowed).toContain('MPL-2.0');
    for (const path of ['.gspot/config/app/licenses.json', '.gspot/config/app/child/licenses.json'])
        expect(parsed.get(path)!.packages_allowed).toStrictEqual([
            { package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed installed metadata.' },
        ]);
    for (const path of ['.gspot/config/licenses.json', '.gspot/config/sibling/licenses.json'])
        expect(parsed.get(path)!.packages_allowed).toStrictEqual([]);
});
