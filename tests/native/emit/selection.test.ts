import { join } from 'node:path';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';
import { writeFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { parse, stringify } from 'smol-toml';

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
            presets: ['spelling'],
            tools: { typos: { exclude: [{ paths: patterns, reason: 'Generated input is checked by its owner.' }] } },
            scope: [{ path: 'nested' }, { path: 'nested/child' }],
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, 'teh\n'])),
    });
    const outputs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('typos.toml'));
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    for (const path of paths) {
        const original = Bun.spawnSync(
            ['typos', '--isolated', '--config', '.gspot/typos.toml', '--force-exclude', `nested/${path}`],
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
            'version = 1\npresets = ["spelling"]\n[[scope]]\npath = "british"\n[scope.tools.typos]\nlocale = "en-gb"\nwords = [{ word = "teh", reason = "An imported name requires this exact spelling." }]\n[[scope]]\npath = "british/child"\n',
        'sample.txt': 'colour teh\n',
        'british/child/sample.txt': 'colour teh\n',
    });
    const output = emitAll(await openSession(sandbox.path));
    const configs = output.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path).sort()).toEqual([
        '.gspot/british/child/typos.toml',
        '.gspot/british/typos.toml',
        '.gspot/typos.toml',
        'british/child/typos.toml',
        'british/typos.toml',
        'typos.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    expect(parse(configs.find(({ path }) => path === 'british/child/typos.toml')!.content)).toMatchObject({
        default: { locale: 'en-gb', 'extend-words': { teh: 'teh' } },
    });
    const run = (config: string, path: string) =>
        Bun.spawnSync(['typos', '--config', config, '--format', 'brief', '--color', 'never', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const root = run('.gspot/typos.toml', 'sample.txt');
    expect(root.exitCode, root.stderr.toString()).toBe(2);
    expect(root.stdout.toString()).toContain('colour');
    expect(root.stdout.toString()).toContain('teh');
    const child = run('.gspot/british/child/typos.toml', 'british/child/sample.txt');
    expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    const editor = Bun.spawnSync(['typos', '--format', 'brief', 'sample.txt'], {
        cwd: join(sandbox.path, 'british/child'),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(editor.exitCode, editor.stdout.toString() + editor.stderr.toString()).toBe(0);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    const corrected = run('.gspot/typos.toml', 'sample.txt');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
});

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["python"]\n[[scope]]\npath = "app"\npresets = ["pytest"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).sort()).toEqual(['.gspot/app/ruff.toml', '.gspot/ruff.toml']);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const root = parse(configs.find(({ path }) => path === '.gspot/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: expect.arrayContaining(['PT']) } });
    const run = (config: string, path: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const unselected = run('.gspot/ruff.toml', 'tests/test_example.py');
    expect(unselected.exitCode, unselected.stdout.toString() + unselected.stderr.toString()).toBe(0);
    const failed = run('.gspot/app/ruff.toml', 'app/tests/test_example.py');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('.gspot/app/ruff.toml', 'app/tests/test_example.py');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), 'assert True\n');
    const rootAssertion = run('.gspot/ruff.toml', 'tests/test_example.py');
    expect(rootAssertion.exitCode, rootAssertion.stderr.toString()).toBe(1);
    expect(JSON.parse(rootAssertion.stdout.toString())).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('.gspot/app/ruff.toml', 'app/tests/test_example.py');
    expect(testAssertion.exitCode, testAssertion.stderr.toString()).toBe(0);
});

test('Squawk uses the effective transaction setting for each scope and honors false under Supabase', async () => {
    await using sandbox = await testdir();
    const defect =
        "SET lock_timeout = '5s';\nSET statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["supabase"]\n[tools.squawk]\nassume_in_transaction = false\n[[scope]]\npath = "transactional"\n[scope.tools.squawk]\nassume_in_transaction = true\n[[scope]]\npath = "transactional/child"\n',
        'migration.sql': defect,
        'transactional/child/migration.sql': 'SELECT 1;\n',
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('/squawk.toml'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, parse(content)['assume_in_transaction']])),
    ).toEqual({
        '.gspot/squawk.toml': false,
        '.gspot/transactional/squawk.toml': true,
        '.gspot/transactional/child/squawk.toml': true,
    });
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (config: string) =>
        Bun.spawnSync(['squawk', '--config', config, '--reporter', 'json', 'migration.sql'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const transactional = run('.gspot/transactional/child/squawk.toml');
    expect(transactional.exitCode, transactional.stderr.toString()).toBe(0);
    const failed = run('.gspot/squawk.toml');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ rule_name: 'prefer-robust-stmts' }]);
    await Bun.write(join(sandbox.path, 'migration.sql'), defect.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '));
    const corrected = run('.gspot/squawk.toml');
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

test('SQLFluff honors root and nested dialect settings over the database default', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["postgres"]\n[tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "warehouse"\n[scope.tools.sqlfluff]\ndialect = "duckdb"\n[[scope]]\npath = "warehouse/child"\n',
        'query.sql': 'PRAGMA table_info (users);\n',
        'warehouse/child/query.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session).files.filter((file) => file.path.endsWith('sqlfluff.cfg'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, /^dialect = (.+)$/mu.exec(content)?.[1]])),
    ).toEqual({
        '.gspot/sqlfluff.cfg': 'sqlite',
        '.gspot/warehouse/sqlfluff.cfg': 'duckdb',
        '.gspot/warehouse/child/sqlfluff.cfg': 'duckdb',
    });
    const config = configs.find((file) => file.path === '.gspot/sqlfluff.cfg')!;
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

test.each([
    ['cloudflare', 'workers'],
    ['express', 'express'],
    ['fastapi', 'fastapi'],
    ['supabase', 'supabase'],
])('%s security output follows the selected security preset', async (preset, name) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\npresets = ["${preset}"]\n`,
    });
    const target = `.gspot/semgrep/${name}.yml`;
    const plainOutput = emitAll(await openSession(sandbox.path));
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), `version = 1\npresets = ["${preset}", "security"]\n`);
    const securityOutput = emitAll(await openSession(sandbox.path));
    const configuration = securityOutput.files.find((file) => file.path === target);
    expect(configuration?.content).toContain('rules:');
});

test.each(['recommended', 'all'])('generated %s ESLint configuration makes layout opt-in', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\npresets = ["typescript"]\n`,
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    symlinkSync(
        fileURLToPath(new URL('../../../node_modules', import.meta.url)),
        join(sandbox.path, 'node_modules'),
        'dir',
    );
    const output = emitAll(await openSession(sandbox.path));
    const config = output.files.find((file) => file.path === '.gspot/eslint.config.mjs');
    expect(config).toBeDefined();
    mkdirSync(join(sandbox.path, '.gspot'));
    writeFileSync(join(sandbox.path, '.gspot/eslint.config.mjs'), config!.content);
    const eslint = new ESLint({
        cwd: sandbox.path,
        overrideConfigFile: join(sandbox.path, '.gspot/eslint.config.mjs'),
    });
    const [result] = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', {
        filePath: 'src/order.js',
    });
    expect(result?.fatalErrorCount).toBe(0);
    const layout = result!.messages.filter((message) => message.ruleId === 'gspot/private-before-public');
    if (level === 'recommended') expect(layout).toEqual([]);
    else expect(layout).toMatchObject([{ ruleId: 'gspot/private-before-public', line: 2 }]);
});

test('license configuration retains scoped exceptions and inherited license allowances', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml':
            'version = 1\npresets = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MPL-2.0"]\n[[scope]]\npath = "app"\n[[scope.tools.licenses.packages_allowed]]\npackage = "example@1.2.3"\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
    });
    const configs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) =>
        path.endsWith('/licenses.json'),
    );
    const parsed = new Map(configs.map(({ path, content }) => [path, JSON.parse(content)]));
    expect(parsed.size).toBe(4);
    for (const path of [
        '.gspot/licenses.json',
        '.gspot/app/licenses.json',
        '.gspot/app/child/licenses.json',
        '.gspot/sibling/licenses.json',
    ])
        expect(parsed.get(path).licenses_allowed).toContain('MPL-2.0');
    for (const path of ['.gspot/app/licenses.json', '.gspot/app/child/licenses.json'])
        expect(parsed.get(path).packages_allowed).toEqual([
            { package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed installed metadata.' },
        ]);
    for (const path of ['.gspot/licenses.json', '.gspot/sibling/licenses.json'])
        expect(parsed.get(path).packages_allowed).toEqual([]);
});
