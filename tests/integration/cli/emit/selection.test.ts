import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { writeFileSync, symlinkSync, mkdirSync } from 'node:fs';

test.each([
    ['bash', 'bash'],
    ['swift', 'ios'],
    ['cloudflare', 'workers'],
    ['express', 'express'],
    ['fastapi', 'fastapi'],
    ['supabase', 'supabase'],
])('%s security output follows the selected security configuration', async (configuration, name) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = ["${configuration}"]\n`,
    });
    const target = `.gspot/config/semgrep/${name}.yml`;
    const plainOutput = emitAll(await openSession(sandbox.path));
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), `version = 1\nconfigurations = ["${configuration}", "security"]\n`);
    const securityOutput = emitAll(await openSession(sandbox.path));
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toContain('rules:');
});

test.each(['recommended', 'all'])('generated %s ESLint configuration makes layout opt-in', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n`,
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    symlinkSync(
        fileURLToPath(new URL('../../../../node_modules', import.meta.url)),
        join(sandbox.path, 'node_modules'),
        'dir',
    );
    const output = emitAll(await openSession(sandbox.path));
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
    const layout = result!.messages.filter((message) => message.ruleId === 'gspot/private-before-public');
    if (level === 'recommended') expect(layout).toStrictEqual([]);
    else expect(layout).toMatchObject([{ ruleId: 'gspot/private-before-public', line: 2 }]);
});

test('license configuration retains scoped exceptions and inherited license allowances', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml':
            'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MPL-2.0"]\n[[scope]]\npath = "app"\n[[scope.tools.licenses.packages_allowed]]\npackage = "example@1.2.3"\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) =>
        path.endsWith('/licenses.json'),
    );
    const parsed = new Map(configs.map(({ path, content }) => [path, JSON.parse(content)]));
    expect(parsed.size).toBe(4);
    for (const path of [
        '.gspot/config/licenses.json',
        '.gspot/config/app/licenses.json',
        '.gspot/config/app/child/licenses.json',
        '.gspot/config/sibling/licenses.json',
    ])
        expect(parsed.get(path).licenses_allowed).toContain('MPL-2.0');
    for (const path of ['.gspot/config/app/licenses.json', '.gspot/config/app/child/licenses.json'])
        expect(parsed.get(path).packages_allowed).toStrictEqual([
            { package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed installed metadata.' },
        ]);
    for (const path of ['.gspot/config/licenses.json', '.gspot/config/sibling/licenses.json'])
        expect(parsed.get(path).packages_allowed).toStrictEqual([]);
});
