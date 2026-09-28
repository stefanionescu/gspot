import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { statSync, chmodSync, existsSync } from 'node:fs';
import { containing } from '#tests/support/expectations.ts';
import { checkJavascript } from '#cli/checks/typescript/tsc.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { JAVASCRIPT_AUTHORED_FILES } from '#tests/config/integration/tools/generation.ts';

test.each(['recommended', 'all'])('JavaScript checking includes authored build directories at %s', async (level) => {
    await using sandbox = await testdir();
    const paths = ['source/build/value.js', 'source/dist/value.js', 'coverage/value.js'];
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nkits = ["javascript"]\n[guides]\ninstall = false\n[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n`,
        ...Object.fromEntries([...paths, 'emitted/value.js'].map((path) => [path, 'export const value = missing;\n'])),
    });
    const environment = { PATH: toolsPath(['tsc']) };
    const session = await openSession(sandbox.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.gspot/config/jsconfig.json')!;
    await Bun.write(join(sandbox.path, generated.path), generated.content);
    const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command, environment);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = JSON.parse(broken.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(
        paths.toSorted((left, right) => left.localeCompare(right)),
    );
    for (const path of paths) await Bun.write(join(sandbox.path, path), 'export const value = 1;\n');
    const corrected = await run(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([false, true])(
    'JavaScript checking preserves repository resolution and excludes private ambient types (authored: %s)',
    async (authored) => {
        await using sandbox = await testdir();
        const authoredFiles: Record<string, string> = authored ? JAVASCRIPT_AUTHORED_FILES : {};
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';\nexport const text = format(42);\nexport const total = accepted;\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nkits = ["javascript"]\n[guides]\ninstall = false\n',
            'source/main.js': source,
            'source/value.js':
                '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
            'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
            '.gspot/node_modules/@types/private/index.d.ts': 'This is invalid private tooling input.\n',
            'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
            ...authoredFiles,
        });
        const session = await openSession(sandbox.path);
        const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        }).files.find(({ path }) => path === '.gspot/config/jsconfig.json')!;
        await Bun.write(join(sandbox.path, generated.path), generated.content);
        chmodSync(join(sandbox.path, generated.path), 0o444);
        const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
        const env = { PATH: toolsPath(['tsc']) };
        const broken = await run(sandbox.path, command, env);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
        ]);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(1);
        await Bun.write(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
        const corrected = await run(sandbox.path, command, env);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'authored/cache.tsbuildinfo')).text()).toBe(
            'Preserve this authored metadata.\n',
        );
        expect(await Bun.file(join(sandbox.path, generated.path)).text()).toBe(generated.content);
        expect(statSync(join(sandbox.path, generated.path)).mode & 0o777).toBe(0o444);
        expect(existsSync(join(sandbox.path, 'jsconfig.json'))).toBe(authored);
        for (const [path, original] of Object.entries(authoredFiles))
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    },
    60_000,
);

test('JavaScript checking reports a broken authored configuration without rewriting it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nkits = ["javascript"]\n[guides]\ninstall = false\n',
        'source.js': 'export const value = 1;\n',
        'jsconfig.json': '{}',
    });
    const session = await openSession(sandbox.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.gspot/config/jsconfig.json')!;
    await Bun.write(join(sandbox.path, generated.path), generated.content);
    await Bun.write(join(sandbox.path, 'jsconfig.json'), '{');
    const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
    const env = { PATH: toolsPath(['tsc']) };
    const invalid = await run(sandbox.path, command, env);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stderr).toContain('jsconfig.json');
    expect(await Bun.file(join(sandbox.path, 'jsconfig.json')).text()).toBe('{');
    await Bun.write(join(sandbox.path, 'jsconfig.json'), '{}');
    const corrected = await run(sandbox.path, command, env);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('JavaScript projects retain nested compiler options and isolate the deepest scope', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nkits = ["javascript"]\n[guides]\ninstall = false\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    const bad = '/** @type {string} */\nexport const name = 42;\n';
    const corrected = bad.replace('42', '"name"');
    const config = '{"extends":"./base.json"}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.js': corrected,
        'app/source.js': 'export const value = localValue;\n',
        'app/node_modules/@types/domain/index.d.ts': 'declare const localValue: string;\n',
        'app/jsconfig.json': config,
        'app/base.json':
            '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","types":["domain"],"incremental":true,"tsBuildInfoFile":"authored.cache"},"include":["**/*.js"],"exclude":["excluded"]}',
        'app/excluded/ignored.js': 'unknownValue();\n',
        'app/authored.cache': 'Preserve this cache.\n',
        'app/child/source.js': bad,
        'sibling/source.js': corrected,
    });
    const session = await openSession(sandbox.path);
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/jsconfig.json'));
    expect(outputs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/child/jsconfig.json',
        '.gspot/config/app/jsconfig.json',
        '.gspot/config/jsconfig.json',
        '.gspot/config/sibling/jsconfig.json',
    ]);
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
    const env = { PATH: toolsPath(['tsc']) };
    const broken = await run(sandbox.path, command, env);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = JSON.parse(broken.stdout) as RunReport;
    expect(
        report.checks.flatMap(({ scope, findings }) => findings.map((finding) => ({ scope, finding }))),
    ).toStrictEqual([
        {
            scope: 'app/child',
            finding: containing({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
        },
    ]);
    await Bun.write(join(sandbox.path, 'app/child/source.js'), corrected);
    const fixed = await run(sandbox.path, command, env);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe(config);
    expect(await Bun.file(join(sandbox.path, 'app/authored.cache')).text()).toBe('Preserve this cache.\n');
    for (const output of outputs) expect(await Bun.file(join(sandbox.path, output.path)).text()).toBe(output.content);
    await Bun.write(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = await run(sandbox.path, command, env);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stderr).toContain('app/jsconfig.json');
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe('{');
}, 60_000);

test('a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nkits = ["javascript"]\n[guides]\ninstall = false\n[[scope]]\npath = "site"\nkits = ["javascript"]\n',
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    for (const project of projects) await Bun.write(join(sandbox.path, project.path), project.content);
    const reopened = await openSession(sandbox.path);
    const [root] = await planRun(reopened, { stage: 'push', skips: [], only: ['javascript/checkjs'] });
    // A policy change plans the check in every scope, including one with no JavaScript file.
    const site = { ...root!, scope: reopened.scopes.find((entry) => entry.scope.path === 'site')!, files: [] };
    expect(await checkJavascript(reopened, site)).toMatchObject({
        check: 'javascript/checkjs',
        scope: 'site',
        status: 'ok',
        files: 0,
        findings: [],
    });
});
