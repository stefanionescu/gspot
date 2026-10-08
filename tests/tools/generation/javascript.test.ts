import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stat, chmod } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { JAVASCRIPT_AUTHORED_FILES } from '#tests/config/tools/generation/javascript.ts';

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
    writeGeneratedFiles(session, log);
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
        writeGeneratedFiles(session, log, undefined, emitted);
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
    writeGeneratedFiles(session, log, undefined, emitted);
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
