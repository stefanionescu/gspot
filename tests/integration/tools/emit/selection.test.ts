import { executeRun } from '#cli/run/execute.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { chmodSync, statSync } from 'node:fs';
import type { RunReport } from '#cli/output/schema.ts';

import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

import { installPythonProject, resolvePythonProject } from '#cli/tools/python-project.ts';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { parse, stringify } from 'smol-toml';
import { emitAll } from '#cli/emit/targets.ts';

import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';

test.each([
    ['nested/src/**'],
    ['**/src/**'],
    ['*.txt', '!**/keep.txt'],
    ['{nested/src,other/lib}/**'],
    ['nested/[st]rc/**'],
    ['/nested/src/'],
    ['nested'],
    ['**/nested/**/src/*'],
])('spelling exclusions %j preserve native results in scoped editor configurations', async (...patterns) => {
    await using sandbox = await testdir();
    const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['spelling'],
            tools: { typos: { exclude: [{ paths: patterns, reason: 'Generated input is checked by its owner.' }] } },
            scope: [{ path: 'nested' }, { path: 'nested/child' }],
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, 'teh\n'])),
    });
    const outputs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('typos.toml'));
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    for (const path of paths) {
        const original = Bun.spawnSync(
            ['typos', '--isolated', '--config', '.gspot/config/typos.toml', '--force-exclude', `nested/${path}`],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
        const editor = Bun.spawnSync(['typos', '--force-exclude', path], {
            cwd: join(sandbox.path, 'nested'),
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect([0, 2]).toContain(original.exitCode);
        expect(editor.exitCode, `${path}: ${editor.stdout.toString()}${editor.stderr.toString()}`).toBe(
            original.exitCode,
        );
    }
});

test('spelling locales and word allowances remain scoped in generated configurations and editor copies', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["spelling"]\n[[scope]]\npath = "british"\n[scope.tools.typos]\nlocale = "en-gb"\nwords = [{ word = "teh", reason = "An imported name requires this exact spelling." }]\n[[scope]]\npath = "british/child"\n',
        'sample.txt': 'colour teh\n',
        'british/child/sample.txt': 'colour teh\n',
    });
    const output = emitAll(await openSession(sandbox.path));
    const configs = output.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path).sort()).toStrictEqual([
        '.gspot/config/british/child/typos.toml',
        '.gspot/config/british/typos.toml',
        '.gspot/config/typos.toml',
        'british/child/typos.toml',
        'british/typos.toml',
        'typos.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (config: string, path: string) =>
        Bun.spawnSync(['typos', '--config', config, '--format', 'brief', '--color', 'never', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const root = run('.gspot/config/typos.toml', 'sample.txt');
    expect(root.exitCode, root.stderr.toString()).toBe(2);
    expect(root.stdout.toString()).toContain('colour');
    expect(root.stdout.toString()).toContain('teh');
    const child = run('.gspot/config/british/child/typos.toml', 'british/child/sample.txt');
    expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    const editor = Bun.spawnSync(['typos', '--format', 'brief', 'sample.txt'], {
        cwd: join(sandbox.path, 'british/child'),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(editor.exitCode, editor.stdout.toString() + editor.stderr.toString()).toBe(0);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    const corrected = run('.gspot/config/typos.toml', 'sample.txt');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
});

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["python"]\n[[scope]]\npath = "app"\nconfigurations = ["pytest"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).sort()).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const root = parse(configs.find(({ path }) => path === '.gspot/config/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: expect.arrayContaining(['PT']) } });
    const run = (config: string, path: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const unselected = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(unselected.exitCode, unselected.stdout.toString() + unselected.stderr.toString()).toBe(0);
    const failed = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), 'assert True\n');
    const rootAssertion = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(rootAssertion.exitCode, rootAssertion.stderr.toString()).toBe(1);
    expect(JSON.parse(rootAssertion.stdout.toString())).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(testAssertion.exitCode, testAssertion.stderr.toString()).toBe(0);
});

test('Squawk uses the effective transaction setting for each scope and honors false under Supabase', async () => {
    await using sandbox = await testdir();
    const defect =
        "SET lock_timeout = '5s';\nSET statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["supabase"]\n[tools.squawk]\nassume_in_transaction = false\n[[scope]]\npath = "transactional"\n[scope.tools.squawk]\nassume_in_transaction = true\n[[scope]]\npath = "transactional/child"\n',
        'migration.sql': defect,
        'transactional/child/migration.sql': 'SELECT 1;\n',
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('/squawk.toml'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, parse(content)['assume_in_transaction']])),
    ).toStrictEqual({
        '.gspot/config/squawk.toml': false,
        '.gspot/config/transactional/squawk.toml': true,
        '.gspot/config/transactional/child/squawk.toml': true,
    });
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (config: string) =>
        Bun.spawnSync(['squawk', '--config', config, '--reporter', 'json', 'migration.sql'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const transactional = run('.gspot/config/transactional/child/squawk.toml');
    expect(transactional.exitCode, transactional.stderr.toString()).toBe(0);
    const failed = run('.gspot/config/squawk.toml');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ rule_name: 'prefer-robust-stmts' }]);
    await Bun.write(join(sandbox.path, 'migration.sql'), defect.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '));
    const corrected = run('.gspot/config/squawk.toml');
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

test('SQLFluff honors root and nested dialect settings over the database default', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["postgres"]\n[tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "warehouse"\n[scope.tools.sqlfluff]\ndialect = "duckdb"\n[[scope]]\npath = "warehouse/child"\n',
        'query.sql': 'PRAGMA table_info (users);\n',
        'warehouse/child/query.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session).files.filter((file) => file.path.endsWith('sqlfluff.cfg'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, /^dialect = (.+)$/mu.exec(content)?.[1]])),
    ).toStrictEqual({
        '.gspot/config/sqlfluff.cfg': 'sqlite',
        '.gspot/config/warehouse/sqlfluff.cfg': 'duckdb',
        '.gspot/config/warehouse/child/sqlfluff.cfg': 'duckdb',
    });
    const config = configs.find((file) => file.path === '.gspot/config/sqlfluff.cfg')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (dialect?: string) =>
        Bun.spawnSync(
            [
                'sqlfluff',
                'lint',
                '--config',
                config.path,
                '--ignore-local-config',
                '--rules',
                'LT01',
                ...(dialect === undefined ? [] : ['--dialect', dialect]),
                'query.sql',
            ],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
    const wrong = run('postgres');
    expect(wrong.exitCode, wrong.stderr.toString()).toBe(1);
    expect(wrong.stdout.toString()).toContain('PRS');
    const corrected = run();
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

test.each(['recommended', 'all'])(
    'Bash security rules expose their language identity at %s',
    async (level) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["bash", "security"]\n[rules]\ninstall = false\n`;
        const source = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'script.sh': source });
        const outputs = emitAll(await openSession(sandbox.path)).files.filter(
            ({ path }) => path.startsWith('.gspot/config/semgrep/') || path === '.gspot/pyproject.toml',
        );
        await withLifecycleOwner(sandbox.path, async (owner) => {
            await resolvePythonProject(sandbox.path, outputs, owner);
        });
        for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
        await installPythonProject(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
        const broken = await run(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual([
            expect.objectContaining({ file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' }),
            expect.objectContaining({ file: 'script.sh', line: 3, rule: 'gspot.bash.eval' }),
        ]);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(source);
        const corrected = '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n';
        await Bun.write(join(sandbox.path, 'script.sh'), corrected);
        const clean = await run(sandbox.path, command);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(corrected);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
    120_000,
);

test('framework security packs stay within inherited scopes and preserve sibling input', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["javascript", "security"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = ["express"]\n[scope.tools.semgrep]\nignore = [{ paths = ["app/**/ignored.js"], reason = "Generated fixtures are checked by their producer." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    const source = 'res.send(req.body);\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.js': source,
        'app/source.js': source,
        'app/child/source.js': source,
        'sibling/source.js': source,
        'app/ignored.js': 'eval(input);\n',
        'app/child/ignored.js': 'eval(input);\n',
        'sibling/ignored.js': 'eval(input);\n',
    });
    const outputs = emitAll(await openSession(sandbox.path)).files.filter(
        ({ path }) => path.includes('/semgrep/') || path.endsWith('.semgrepignore') || path === '.gspot/pyproject.toml',
    );
    await withLifecycleOwner(sandbox.path, async (owner) => {
        await resolvePythonProject(sandbox.path, outputs, owner);
    });
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    await installPythonProject(sandbox.path);
    const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
            findings.map((finding) => ({ scope, finding })),
        ),
    ).toStrictEqual([
        {
            scope: 'app',
            finding: expect.objectContaining({ file: 'app/source.js', line: 1, rule: 'express-res-send-raw-input' }),
        },
        {
            scope: 'app/child',
            finding: expect.objectContaining({
                file: 'app/child/source.js',
                line: 1,
                rule: 'express-res-send-raw-input',
            }),
        },
        {
            scope: 'sibling',
            finding: expect.objectContaining({ file: 'sibling/ignored.js', line: 1, rule: 'node-no-eval' }),
        },
    ]);
    for (const path of ['app/source.js', 'app/child/source.js'])
        await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
    await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'source.js')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'sibling/source.js')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/broken.yml');
    await Bun.write(invalidRule, 'rules: [');
    const invalid = await run(sandbox.path, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
        'error',
    );
    expect(await Bun.file(invalidRule).text()).toBe('rules: [');
    await Bun.file(invalidRule).delete();
    const recovered = await run(sandbox.path, command);
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
}, 120_000);

test('Docker configuration scans isolate deepest scopes and retain scoped advisory exceptions', async () => {
    await using sandbox = await testdir();
    const source =
        'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nUSER root\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const policy =
        'version = 1\nconfigurations = ["docker"]\n[[scope]]\npath = "app"\n[scope.tools.trivy]\nignore = [{ id = "DS-0002", reason = "This test exercises inherited advisory exceptions." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, source])),
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'untracked/Dockerfile'), source);
    const session = await openSession(sandbox.path);
    for (const file of emitAll(session).files.filter((file) => file.kind === 'config'))
        await Bun.write(join(sandbox.path, file.path), file.content);
    const options = {
        stage: 'push' as const,
        only: ['docker/trivy-config'],
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    };
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    expect(
        failed.report.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'fail', files: ['Dockerfile'] },
        { scope: 'app', status: 'ok', files: [] },
        { scope: 'app/child', status: 'ok', files: [] },
        { scope: 'sibling', status: 'fail', files: ['sibling/Dockerfile'] },
    ]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await Bun.write(join(sandbox.path, path), source.replace('USER root', 'USER node'));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'app/Dockerfile')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'untracked/Dockerfile')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});

test.each([false, true])(
    'JavaScript checking preserves repository resolution and excludes private ambient types (authored: %s)',
    async (authored) => {
        await using sandbox = await testdir();
        const config = '{"extends":"./base.json"}\n';
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';\nexport const text = format(42);\nexport const total = accepted;\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n',
            'source/main.js': source,
            'source/value.js':
                '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
            'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
            '.gspot/node_modules/@types/private/index.d.ts': 'This is invalid private tooling input.\n',
            'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
            ...(authored
                ? {
                      'jsconfig.json': config,
                      'base.json': JSON.stringify({
                          compilerOptions: {
                              target: 'ES2022',
                              module: 'ESNext',
                              moduleResolution: 'Bundler',
                              baseUrl: '.',
                              paths: { '@shape/*': ['source/*'] },
                              types: ['domain'],
                              incremental: true,
                              tsBuildInfoFile: 'authored/cache.tsbuildinfo',
                          },
                          include: ['source/**/*.js'],
                          exclude: ['excluded'],
                      }),
                      'excluded/source.js': 'UnknownDependency();\n',
                  }
                : {}),
        });
        const generated = emitAll(await openSession(sandbox.path)).files.find(
            ({ path }) => path === '.gspot/config/jsconfig.json',
        )!;
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
        if (authored) {
            expect(await Bun.file(join(sandbox.path, 'jsconfig.json')).text()).toBe(config);
            await Bun.write(join(sandbox.path, 'jsconfig.json'), '{');
            const invalid = await run(sandbox.path, command, env);
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
            expect(invalid.stderr).toContain('jsconfig.json');
            expect(await Bun.file(join(sandbox.path, 'jsconfig.json')).text()).toBe('{');
        }
    },
    60_000,
);

test('JavaScript projects retain nested compiler options and isolate the deepest scope', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
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
    const outputs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) =>
        path.endsWith('/jsconfig.json'),
    );
    expect(outputs.map(({ path }) => path).sort()).toStrictEqual([
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
            finding: expect.objectContaining({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
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
