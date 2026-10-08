import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stat, chmod } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';

import {
    IMPORT_FIX_SCRIPT,
    SCRIPT_LINT_SOURCE,
    JAVASCRIPT_AUTHORED_FILES,
} from '#tests/config/tools/generation/javascript.ts';

test.each(['recommended', 'all'] as const)(
    '%s native import fixes preserve executable Node ESM paths',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'lib/index.js': 'export const value = 42;\n',
            'source.js': "import { value } from './lib/index.js';\nexport const result = value;\n",
            'redundant.js': "import { value } from './lib/../lib/index.js';\nexport const result = value;\n",
        });
        const eslint = await createEslint(sandbox.path);
        const before = await eslint.lintFiles(['source.js', 'redundant.js']);
        expect(
            before.flatMap(({ filePath, messages }) =>
                messages.flatMap(({ ruleId, line, severity, fix }) =>
                    ruleId === 'import-x/no-useless-path-segments'
                        ? [{ file: filePath.slice(sandbox.path.length + 1), line, severity, fix: fix?.text }]
                        : [],
                ),
            ),
        ).toStrictEqual([{ file: 'redundant.js', line: 1, severity: 2, fix: '"./lib/index.js"' }]);
        const native = await runTestCommand(['node', '--input-type=module', '-e', IMPORT_FIX_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(native.stdout).toBe('[]');
        for (const path of ['source.js', 'redundant.js']) {
            expect(await Bun.file(join(sandbox.path, path)).text()).toContain('./lib/index.js');
            const runtime = await runTestCommand(
                [
                    'node',
                    '--input-type=module',
                    '-e',
                    `import assert from 'node:assert/strict'; import { result } from './${path}'; assert.equal(result, 42);`,
                ],
                { cwd: sandbox.path },
            );
            expect(runtime.code, runtime.stdout + runtime.stderr).toBe(0);
        }
    },
);

test.each(['recommended', 'all'] as const)(
    '%s native scripts have one unused-variable owner and permit process output and exit',
    async (level) => {
        await using sandbox = await testdir();
        const source = 'const unused = 1;\nconsole.log("result");\nprocess.exit(0);\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
            'scripts/run.js': source,
            'scripts/run.ts': source.replace('unused =', 'unused: number ='),
            'build.config.ts': source.replace('unused =', 'unused: number ='),
            'src/source.ts': source.replace('unused =', 'unused: number ='),
        });
        await createEslint(sandbox.path);
        const native = await runTestCommand(['node', '--input-type=module', '-e', SCRIPT_LINT_SOURCE], {
            cwd: sandbox.path,
        });
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(native.stdout).toBe(
            JSON.stringify(
                ['scripts/run.js', 'scripts/run.ts', 'build.config.ts', 'src/source.ts'].map((file) => ({
                    file,
                    findings: [
                        {
                            ruleId: file.endsWith('.js') ? 'no-unused-vars' : '@typescript-eslint/no-unused-vars',
                            line: 1,
                            severity: 2,
                        },
                        ...(file === 'src/source.ts' && level === 'all'
                            ? [
                                  { ruleId: 'n/no-process-exit', line: 3, severity: 2 },
                                  { ruleId: 'no-console', line: 2, severity: 2 },
                                  { ruleId: 'unicorn/no-process-exit', line: 3, severity: 2 },
                              ]
                            : []),
                    ],
                })),
            ),
        );
        for (const path of ['scripts/run.js', 'scripts/run.ts', 'build.config.ts'])
            await Bun.write(join(sandbox.path, path), source.slice(source.indexOf('\n') + 1));
        await Bun.write(join(sandbox.path, 'src/source.ts'), 'export const result = 1;\n');
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', SCRIPT_LINT_SOURCE], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(
            JSON.stringify(
                ['scripts/run.js', 'scripts/run.ts', 'build.config.ts', 'src/source.ts'].map((file) => ({
                    file,
                    findings: [],
                })),
            ),
        );
    },
);

test('JavaScript checking includes authored build directories at all', async () => {
    await using sandbox = await testdir();
    const paths = ['source/build/value.js', 'source/dist/value.js', 'coverage/value.js'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[agent_rules]\nenabled = false\n[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n',
            level: 'all',
        }),
        ...Object.fromEntries([...paths, 'emitted/value.js'].map((path) => [path, 'export const value = missing;\n'])),
    });
    const environment = { PATH: buildToolsPath(['tsc']) };
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log);
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = await spawnGspot(sandbox.path, command, environment);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = JSON.parse(broken.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(
        paths.toSorted((left, right) => left.localeCompare(right)),
    );
    for (const path of paths) await Bun.write(join(sandbox.path, path), 'export const value = 1;\n');
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([false, true])(
    'JavaScript checking preserves repository resolution and excludes private ambient types (authored: %s)',
    async (authored) => {
        await using sandbox = await testdir();
        const authoredFiles: Record<string, string> = authored ? JAVASCRIPT_AUTHORED_FILES : {};
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';\nexport const text = format(42);\nexport const total = accepted;\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n' }),
            'source/main.js': source,
            'source/value.js':
                '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
            'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
            '.gspot/node_modules/@types/private/index.d.ts': 'This is invalid private tooling input.\n',
            'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
            ...authoredFiles,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const generated = emitted.files.find(({ path }) => path === '.gspot/config/jsconfig.json')!;
        using log = openOwnership(sandbox.path);
        writeOutputs(session, log, undefined, emitted);
        await chmod(join(sandbox.path, generated.path), 0o444);
        const command = ['check', '--only', 'javascript/tsc', '--json'];
        const env = { PATH: buildToolsPath(['tsc']) };
        const broken = await spawnGspot(sandbox.path, command, env);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
        ]);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(1);
        await Bun.write(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
        const corrected = await spawnGspot(sandbox.path, command, env);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'authored/cache.tsbuildinfo')).text()).toBe(
            'Preserve this authored metadata.\n',
        );
        expect(await Bun.file(join(sandbox.path, generated.path)).text()).toBe(generated.content);
        const { mode } = await stat(join(sandbox.path, generated.path));
        expect(mode & 0o777).toBe(getKeptMode(0o444));
        expect(await pathExists(join(sandbox.path, 'jsconfig.json'))).toBe(authored);
        for (const [path, original] of Object.entries(authoredFiles))
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    },
);

test('JavaScript projects retain nested compiler options and isolate the deepest scope', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['javascript'], {
        tables: '[agent_rules]\nenabled = false\n[scope."app"]\n[scope."app/child"]\n[scope."sibling"]\n',
    });
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
    const emitted = emitAll(session);
    const outputs = emitted.files.filter(({ path }) => path.endsWith('/jsconfig.json'));
    expect(outputs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/child/jsconfig.json',
        '.gspot/config/app/jsconfig.json',
        '.gspot/config/jsconfig.json',
        '.gspot/config/sibling/jsconfig.json',
    ]);
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log, undefined, emitted);
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const env = { PATH: buildToolsPath(['tsc']) };
    const broken = await spawnGspot(sandbox.path, command, env);
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
    const fixed = await spawnGspot(sandbox.path, command, env);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe(config);
    expect(await Bun.file(join(sandbox.path, 'app/authored.cache')).text()).toBe('Preserve this cache.\n');
    for (const output of outputs) expect(await Bun.file(join(sandbox.path, output.path)).text()).toBe(output.content);
    await Bun.write(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = await spawnGspot(sandbox.path, command, env);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    // The scope with the unreadable configuration errors alone; the other scope keeps its result.
    const errored = (JSON.parse(invalid.stdout) as RunReport).checks.filter((check) => check.status === 'error');
    expect(errored.map((check) => check.note?.includes('app/jsconfig.json'))).toStrictEqual([true]);
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe('{');
});
