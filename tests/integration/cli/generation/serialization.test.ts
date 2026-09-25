import { initCommand } from '#cli/commands/init/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { mergeStub } from '#cli/generation/stubs.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { expect, test } from 'bun:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import { parse as parseYaml } from 'yaml';

test('typos output preserves quoted keys and paths without creating settings', async () => {
    const words = ['quoted"word', 'dotted.word', String.raw`back\slash`, 'café', "apostrophe'word"];
    const paths = ['docs/"draft"/**', String.raw`generated/\draft/**`, 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['spelling'],
            tools: { typos: { words: words.map((word) => ({ word, reason })), exclude: [{ paths, reason }] } },
        }),
    });
    const renderSession1 = await openSession(sandbox.path);
    const output = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    });
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content);
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'default',
        'files',
        'type',
    ]);
    expect(parsed['type']).toStrictEqual({
        'gspot-policy': {
            'extend-glob': ['gspot.toml'],
            'extend-words': Object.fromEntries(words.map((word) => [word, word])),
        },
    });
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': expect.arrayContaining(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': expect.arrayContaining(['**']) });
});

test('profile spelling values use the same TOML emission path', async () => {
    const word = 'café."upstream"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'house.profile.toml': stringify({
            version: 1,
            profile: 'house',
            selection: 'exact',
            configurations: ['spelling'],
            tools: { typos: { words: [{ word, reason: 'An upstream name with # and "quotes".' }] } },
        }),
    });
    const proposal = await initCommand({
        cwd: sandbox.path,
        from: 'house.profile.toml',
        yes: true,
        isDryRun: true,
        json: true,
        install: false,
        allowDirty: true,
        hooks: 'none',
        ci: 'none',
        runner: 'none',
        rules: 'no',
    });
    expect(proposal.exitCode).toBe(0);
    const policy = proposal.json['policy'];
    if (typeof policy !== 'string') throw new Error('The initialization proposal has no policy text.');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const renderSession2 = await openSession(sandbox.path);
    const output = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    });
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});

test('TOML tool configurations round-trip dynamic strings and option keys', async () => {
    const text = 'café "quoted" \\value # comment';
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['secrets', 'dependencies', 'configs', 'docs', 'python', 'postgres'],
            format: { indent_style: 'tab' },
            tools: {
                gitleaks: { allow: [{ description: text, paths: [path], regexes: [text], reason }] },
                osv: { ignore: [{ id: text, reason, review_by: '2026-09-20' }] },
                taplo: { rules: { [option]: text, column_width: 88 } },
                lychee: { exclude: [{ patterns: [text], reason }] },
                squawk: { frozen_through: 'all' },
            },
            ignore: [{ check: 'python/ruff', rule: 'F401', paths: [path], reason }],
        }),
        'migrations/20260101_initial.sql': 'select 1;\n',
    });
    const renderSession3 = await openSession(sandbox.path);
    const output = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
        version: renderSession3.version,
        packageManager: renderSession3.packageManager,
    });
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parse(file.content)]),
    );
    expect(parsed.get('.gspot/config/gitleaks.toml')).toStrictEqual({
        extend: { useDefault: true },
        allowlists: [{ description: text, paths: [path], regexes: [text] }],
    });
    expect(parsed.get('.gspot/config/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2026-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/config/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/config/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/config/ruff.toml')).toMatchObject({ lint: { 'per-file-ignores': { [path]: ['F401'] } } });
    expect(parsed.get('.gspot/config/squawk.toml')).toMatchObject({
        excluded_paths: ['migrations/20260101_initial.sql'],
    });
});

test('an OSV expiry cannot inject another TOML table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['dependencies'],
            tools: {
                osv: {
                    ignore: [
                        {
                            id: 'GHSA-example',
                            reason: 'Reviewed upstream.',
                            review_by: '2026-09-20\n[extra]\ninjected = true',
                        },
                    ],
                },
            },
        }),
    });
    const session = await openSession(sandbox.path);
    expect(() =>
        emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }),
    ).toThrow();
});

test('reason comments cannot add JavaScript statements or ignore entries', async () => {
    const parser = await parserFor('javascript');
    const shapes: string[] = [];
    const reasons = [
        'Reviewed upstream.',
        'Reviewed upstream.\n];\nglobalThis.injected = true;\nexport default [',
        'Reviewed upstream.\u{2028}];\u{2029}globalThis.injected = true;\nexport default [',
    ];
    for (const reason of reasons) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                configurations: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { extra: { reason, name: 'custom' } },
                    trivy: { ignore: [{ id: 'CVE-2026-12345', reason }] },
                },
                ignore: [{ check: 'prose/vale', rule: 'Vale.Spelling', reason }],
            }),
        });
        const renderSession4 = await openSession(sandbox.path);
        const output = emitAll(renderSession4.policyFiles.policy, renderSession4.repository, renderSession4.scopes, {
            version: renderSession4.version,
            packageManager: renderSession4.packageManager,
        });
        const script = output.files.find((file) => file.path === '.gspot/config/eslint.config.mjs');
        expect(script).toBeDefined();
        const tree = parser.parse(script!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            shapes.push(tree!.rootNode.toString());
        } finally {
            tree!.delete();
        }
        const ignored = output.files.find((file) => file.path === '.gspot/config/trivyignore');
        expect(ignored).toBeDefined();
        expect(ignored!.content.split('\n').filter((line) => line !== '' && !line.startsWith('#'))).toStrictEqual([
            'CVE-2026-12345',
        ]);
        const vale = output.files.find((file) => file.path === '.gspot/config/vale.ini');
        expect(vale).toBeDefined();
        expect(
            vale!.content
                .split('\n')
                .filter((line) => line !== '' && !line.startsWith('#'))
                .every((line) => !line.includes('globalThis')),
        ).toBe(true);
    }
    expect(new Set(shapes).size).toBe(1);
});

test('JSON option keys and YAML values keep their literal structure', async () => {
    const key = 'custom"key\\name\ncafé';
    const value = 'yes: # quoted "value"';
    const extra = { reason: 'An upstream option.', [key]: value };
    const project = 'ios/App: # café.xcodeproj';
    const scheme = 'null';
    const registries = ['null', 'registry.example.com:5000'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['typescript', 'formatting', 'markdown', 'configs', 'docker', 'swift'],
            tools: {
                prettier: { extra },
                knip: { extra },
                markdownlint: { rules: { [key]: value } },
                yamllint: { rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } } },
                xcode: { project, scheme },
                hadolint: { trusted_registries: registries },
                trivy: { timeout: '10m', severity: 'HIGH,CRITICAL' },
            },
        }),
    });
    const renderSession5 = await openSession(sandbox.path);
    const output = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
    });
    for (const path of ['.gspot/config/prettier.json', '.gspot/config/knip.json', '.gspot/config/markdownlint.jsonc']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [key]: value });
    }
    const markdownCli = output.files.find((entry) => entry.path === '.gspot/config/markdownlint-cli2.mjs')!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await Bun.write(markdownPath, markdownCli.content);
    const native = Bun.spawnSync(
        [
            process.execPath,
            '-e',
            'const {default: configuration} = await import(process.argv[1]); process.stdout.write(JSON.stringify(configuration.config));',
            pathToFileURL(markdownPath).href,
        ],
        { stdout: 'pipe', stderr: 'pipe' },
    );
    expect(native.exitCode, native.stderr.toString()).toBe(0);
    expect(JSON.parse(native.stdout.toString())).toMatchObject({ [key]: value });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/config/periphery.yml')).toMatchObject({ project, schemes: [scheme] });
    expect(yaml.get('.gspot/config/hadolint.yaml')).toMatchObject({ trustedRegistries: registries });
    expect(yaml.get('.gspot/config/yamllint.yml')).toMatchObject({
        rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } },
    });
    expect(yaml.get('.gspot/config/trivy.yaml')).toMatchObject({ timeout: '10m', severity: ['HIGH', 'CRITICAL'] });
});

test('runtime names remain data in generated JavaScript', async () => {
    const parser = await parserFor('javascript');
    for (const runtime of ['node', 'node }; globalThis.injected = true; //', 'node"\n/* café */']) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                configurations: ['javascript'],
                tools: { eslint: { globals: { '**/*.js': runtime } } },
            }),
        });
        const renderSession6 = await openSession(sandbox.path);
        const output = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
            version: renderSession6.version,
            packageManager: renderSession6.packageManager,
        });
        const file = output.files.find((entry) => entry.path === '.gspot/config/eslint.config.mjs');
        expect(file).toBeDefined();
        const tree = parser.parse(file!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            const indices = tree!.rootNode
                .descendantsOfType('subscript_expression')
                .filter((node) => node.childForFieldName('object')?.text === 'globals')
                .map((node) => node.childForFieldName('index')!.text);
            expect(indices).toHaveLength(1);
            expect(JSON.parse(indices[0]!)).toBe(runtime);
        } finally {
            tree!.delete();
        }
    }
});

test('shared output readers reject external links without changing their targets', async () => {
    await using sandbox = await testdir();
    const original = '{"scripts":{"check":"gspot check"},"extends":"./.gspot/tsconfig.json"}\n';
    await createFileTree(sandbox.path, { 'project/.keep': '', outside: original });
    const project = join(sandbox.path, 'project');
    symlinkSync(join(sandbox.path, 'outside'), join(project, 'linked.json'));
    const stub = { path: 'linked.json', merge: { extends: '{target}' } };
    expect(() => mergeStub(project, stub, stub.path, '.gspot/tsconfig.json')).toThrow('private regular file');
    expect(() => hasConfiguration(project, { path: stub.path, format: 'json', changes: [] })).toThrow(
        'private regular file',
    );
    expect(() =>
        hasConfiguration(project, {
            path: stub.path,
            format: 'json',
            changes: [{ path: ['scripts', 'check'], value: 'gspot check' }],
        }),
    ).toThrow('private regular file');
    expect(() => hasConfiguration(project, { path: stub.path, format: 'yaml', changes: [] })).toThrow(
        'private regular file',
    );
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
});

test.each(['{"extends":"./.gspot/tsconfig.json", invalid}', 'null', '[]'])(
    'malformed shared JSON fails both emission and drift inspection: %s',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'tsconfig.json': content });
        const stub = { path: 'tsconfig.json', merge: { extends: '{target}' } };
        expect(() => mergeStub(sandbox.path, stub, stub.path, '.gspot/tsconfig.json')).toThrow('valid JSON object');
        expect(() => hasConfiguration(sandbox.path, { path: stub.path, format: 'json', changes: [] })).toThrow(
            'valid JSON object',
        );
        expect(readFileSync(join(sandbox.path, stub.path), 'utf8')).toBe(content);
    },
);

test('malformed hook and package configuration fails inspection instead of returning empty drift', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'lefthook.yml': 'pre-commit: [\n', 'package.json': '{"scripts":' });
    expect(() => hasConfiguration(sandbox.path, { path: 'lefthook.yml', format: 'yaml', changes: [] })).toThrow(
        'valid YAML mapping',
    );
    expect(() =>
        hasConfiguration(sandbox.path, {
            path: 'package.json',
            format: 'json',
            changes: [{ path: ['scripts', 'check'], value: 'gspot check' }],
        }),
    ).toThrow();
    expect(readFileSync(join(sandbox.path, 'lefthook.yml'), 'utf8')).toBe('pre-commit: [\n');
    expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe('{"scripts":');
});
