import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { parse, stringify } from 'smol-toml';
import { createSandbox } from '@gspot/testing';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { parserFor } from '#cli/naming/parsers.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';

test('typos output preserves quoted keys and paths without creating settings', async () => {
    const words = ['quoted"word', 'dotted.word', String.raw`back\slash`, 'café', "apostrophe'word"];
    const paths = ['docs/"draft"/**', String.raw`generated/\draft/**`, 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await createSandbox({
        'gspot.toml': stringify({
            version: 1,
            presets: ['spelling'],
            tools: { typos: { words: words.map((word) => ({ word, reason })), exclude: [{ paths, reason }] } },
        }),
    });
    const output = emitAll(await openSession(sandbox.path));
    const target = output.files.find((file) => file.path === '.gspot/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content);
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toEqual(['default', 'files']);
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': expect.arrayContaining(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': expect.arrayContaining(['**']) });
});

test('profile spelling values use the same TOML emission path', async () => {
    const word = 'café."upstream"';
    await using sandbox = await createSandbox({
        'house.profile.toml': stringify({
            version: 1,
            profile: 'house',
            selection: 'exact',
            presets: ['spelling'],
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
    const output = emitAll(await openSession(sandbox.path));
    const target = output.files.find((file) => file.path === '.gspot/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});

test('TOML tool configurations round-trip dynamic strings and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await createSandbox({
        'gspot.toml': stringify({
            version: 1,
            presets: ['secrets', 'dependencies', 'config-files', 'docs', 'python', 'postgres'],
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
    const output = emitAll(await openSession(sandbox.path));
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parse(file.content)]),
    );
    expect(parsed.get('.gspot/gitleaks.toml')).toEqual({
        extend: { useDefault: true },
        allowlists: [{ description: text, paths: [path], regexes: [text] }],
    });
    expect(parsed.get('.gspot/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2026-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/ruff.toml')).toMatchObject({ lint: { 'per-file-ignores': { [path]: ['F401'] } } });
    expect(parsed.get('.gspot/squawk.toml')).toMatchObject({ excluded_paths: ['migrations/20260101_initial.sql'] });
});

test('an OSV expiry cannot inject another TOML table', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': stringify({
            version: 1,
            presets: ['dependencies'],
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
    expect(() => emitAll(session)).toThrow();
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
        await using sandbox = await createSandbox({
            'gspot.toml': stringify({
                version: 1,
                presets: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { extra: { reason, name: 'custom' } },
                    trivy: { ignore: [{ id: 'CVE-2026-12345', reason }] },
                },
                prose: { disabled: [{ rule: 'Vale.Spelling', reason }] },
            }),
        });
        const output = emitAll(await openSession(sandbox.path));
        const script = output.files.find((file) => file.path === '.gspot/eslint.config.mjs');
        expect(script).toBeDefined();
        const tree = parser.parse(script!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            shapes.push(tree!.rootNode.toString());
        } finally {
            tree!.delete();
        }
        const ignored = output.files.find((file) => file.path === '.gspot/trivyignore');
        expect(ignored).toBeDefined();
        expect(ignored!.content.split('\n').filter((line) => line !== '' && !line.startsWith('#'))).toEqual([
            'CVE-2026-12345',
        ]);
        const vale = output.files.find((file) => file.path === '.gspot/vale.ini');
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
    await using sandbox = await createSandbox({
        'gspot.toml': stringify({
            version: 1,
            presets: ['typescript', 'formatting', 'markdown', 'config-files', 'docker', 'swift'],
            tools: {
                prettier: { extra },
                typescript: { extra },
                knip: { extra },
                markdownlint: { rules: { [key]: value } },
                yamllint: { rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } } },
                xcode: { project, scheme },
                hadolint: { trusted_registries: registries },
                trivy: { timeout: '10m', severity: 'HIGH,CRITICAL' },
            },
        }),
    });
    const output = emitAll(await openSession(sandbox.path));
    for (const path of ['.gspot/prettier.json', '.gspot/knip.json', '.gspot/markdownlint.jsonc']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [key]: value });
    }
    const typescript = output.files.find((file) => file.path === '.gspot/tsconfig.base.json');
    expect(typescript).toBeDefined();
    expect(JSON.parse(typescript!.content)).toMatchObject({ compilerOptions: { [key]: value } });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/periphery.yml')).toMatchObject({ project, schemes: [scheme] });
    expect(yaml.get('.gspot/hadolint.yaml')).toMatchObject({ trustedRegistries: registries });
    expect(yaml.get('.gspot/yamllint.yml')).toMatchObject({
        rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } },
    });
    expect(yaml.get('.gspot/trivy.yaml')).toMatchObject({ timeout: '10m', severity: ['HIGH', 'CRITICAL'] });
});

test('runtime names remain data in generated JavaScript', async () => {
    const parser = await parserFor('javascript');
    for (const runtime of ['node', 'node }; globalThis.injected = true; //', 'node"\n/* café */']) {
        await using sandbox = await createSandbox({
            'gspot.toml': stringify({
                version: 1,
                presets: ['javascript'],
                tools: { eslint: { globals: { '**/*.js': runtime } } },
            }),
        });
        const output = emitAll(await openSession(sandbox.path));
        const file = output.files.find((entry) => entry.path === '.gspot/eslint.config.mjs');
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
