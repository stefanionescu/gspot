import prettier from 'prettier';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/swift.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';
import { generateFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';

import {
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    IGNORE_LIST_FILES,
    IGNORE_LIST_SETTINGS,
    PRETTIER_IGNORE_CASES,
    PRETTIER_IGNORE_SETTINGS,
} from '#tests/config/generation/config-files/ignore-files.ts';

test('negative ignores follow positives for ordered tools and stay out of tools without negation', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'format', 'spelling', 'duplication'], {
            level: 'all',
            tables: '[[ignore]]\npaths = ["!src/keep.ts", "src/**"]\nreason = "Keep one authored file among generated sources."\n',
        }),
        'src/keep.ts': 'export const kept = 1;\n',
        'src/omit.ts': 'export const omitted = 1;\n',
    });
    const output = generateFiles(await openSession(sandbox.path));
    const prettierIgnore = output.files.find(({ path }) => path === '.prettierignore')!.content;
    await writeFile(join(sandbox.path, '.prettierignore'), prettierIgnore);
    expect(prettierIgnore).toContain('src/**\n!src/keep.ts');
    const ignored = await prettier.getFileInfo(join(sandbox.path, 'src/keep.ts'), {
        ignorePath: join(sandbox.path, '.prettierignore'),
        resolveConfig: false,
    });
    expect(ignored.ignored).toBe(false);
    const eslint = output.files.find(
        ({ path }) => path === getManifestTarget('javascript', 'eslint/eslint.mjs'),
    )!.content;
    expect(eslint).toContain('"!src/keep.ts"');
    expect(eslint.indexOf('"src/**"')).toBeLessThan(eslint.indexOf('"!src/keep.ts"'));
    const typos: unknown = parse(output.files.find(({ path }) => path.endsWith('/typos.toml'))!.content);
    const paths = getValueAt(typos, ['files', 'extend-exclude']) as string[];
    expect(paths.indexOf('src/**')).toBeLessThan(paths.indexOf('!src/keep.ts'));
    expect(paths).toContain('!src/keep.ts');
    const knip = JSON.parse(output.files.find(({ path }) => path.endsWith('/knip.json'))!.content) as {
        ignore: string[];
    };
    expect(knip.ignore).toContain('src/**');
    expect(knip.ignore).toContain('!src/keep.ts');
    const jsconfig = JSON.parse(output.files.find(({ path }) => path.endsWith('/jsconfig.json'))!.content) as {
        exclude: string[];
    };
    expect(jsconfig.exclude).toContain('../../../../src/**');
    expect(jsconfig.exclude.some((path) => path.includes('!'))).toBe(false);
    const jscpd = JSON.parse(output.files.find(({ path }) => path.endsWith('/jscpd.json'))!.content) as {
        ignore: string[];
    };
    expect(jscpd.ignore).toContain('src/**');
    expect(jscpd.ignore.some((path) => path.startsWith('!'))).toBe(false);
});

test.each([true, false])('generated file lists include the CI workflow only when enabled: %p', async (enabled) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({ ci: { enabled, provider: 'github' } }),
        }),
    });
    const generated = generateFiles(await openSession(sandbox.path));
    const prettierIgnore = generated.files.find(({ path }) => path === '.prettierignore')!.content;
    const typos = generated.files.find(({ path }) => path.endsWith('/typos.toml'))!.content;
    const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!.body;
    for (const text of [prettierIgnore, typos, attributes]) {
        expect(text.includes('.github/workflows/gspot.yml')).toBe(enabled);
    }
});

test('shared Markdown settings leave inherited pointers out of generated path ignores', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown'], {
            scopes: [
                { path: 'app', configurations: [] },
                { path: 'docs', configurations: [] },
            ],
        }),
        'README.md': '# Root\n',
        'app/README.md': '# App\n',
        'docs/README.md': '# Docs\n',
    });
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session);
    const pointers = generated.files.filter(({ path }) => path.endsWith('.markdownlint.jsonc')).map(({ path }) => path);
    expect(pointers).toStrictEqual(['.markdownlint.jsonc']);
    const ignored = buildIgnoreSections(session).find(({ key }) => key === 'gspot')!.patterns;
    expect(ignored.filter((path) => path.endsWith('.markdownlint.jsonc'))).toStrictEqual(['/.markdownlint.jsonc']);
});

test.each([...PRETTIER_IGNORE_CASES])(
    'the generated .prettierignore ignores $file: $ignored',
    async ({ file, ignored }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(PRETTIER_IGNORE_SETTINGS.configurations, {
                rules: true,
                tables: stringify({ ignore: PRETTIER_IGNORE_SETTINGS.ignore }),
            }),
            '.gitattributes': '/generated/** linguist-generated\n/vendored/** linguist-vendored\n',
            'package.json': '{"packageManager":"pnpm@9.0.0"}',
            'source.ts': 'export const value = 1;\n',
            [file]: 'const value={enabled:true};\n',
        });

        const generated = generateFiles(await openSession(sandbox.path)).files.find(
            ({ path }) => path === '.prettierignore',
        )!;
        const ignorePath = join(sandbox.path, generated.path);
        await writeFile(ignorePath, generated.content);
        const result = await prettier.getFileInfo(join(sandbox.path, file), { ignorePath, resolveConfig: false });
        expect(result).toStrictEqual({ ignored, inferredParser: ignored ? null : 'typescript' });
    },
);

test.each([...PATH_IGNORE_CASES])(
    '$check: a check-wide path ignore reaches the config file and a rule or other-check ignore does not',
    async ({ configuration, check, file, nativePath }) => {
        const path = getManifestTarget(configuration, file);
        const settings = stringify({
            level: 'all',
            configurations: [...new Set([configuration, 'javascript'])],
            ignore: [
                { check, paths: ['selected/**'], reason: 'This generated sample has its own source owner.' },
                {
                    check,
                    rule: 'example-rule',
                    paths: ['rule-only/**'],
                    reason: 'Only this one finding rule is accepted.',
                },
                {
                    check: 'docs/missing-paths',
                    paths: ['other/**'],
                    reason: 'Only documentation paths are accepted here.',
                },
            ],
        });
        const content = await generateFile(settings, path, { 'source.js': 'export const port = 8080;\n' });
        const parsed: unknown = path.endsWith('.toml') ? parse(content) : (JSON.parse(content) as unknown);
        const patterns = getValueAt(parsed, nativePath);
        expect(patterns).toContain('selected/**');
        expect(patterns).not.toContain('rule-only/**');
        expect(patterns).not.toContain('other/**');
    },
);

test.each([...LANGUAGE_IGNORES])(
    '$name: Prettier ignores only the folders of the selected languages',
    async ({ configurations, scopes, ignored, absent }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(configurations, { rules: true, scopes }),
            'source.js': 'const value = 1;\n',
            'source.py': 'value = 1\n',
            'Source.swift': SWIFT_VALUE_SOURCE,
            'readme.md': '# Example\n',
            'web/source.js': 'const value = 1;\n',
            'web/readme.md': '# Example\n',
        });
        const session = await openSession(sandbox.path);
        const files = new Map(generateFiles(session).files.map(({ path, content }) => [path, content]));
        const prettierignore = files.get('.prettierignore')!;
        await writeFile(join(sandbox.path, '.prettierignore'), prettierignore);
        for (const { path, pattern } of ignored) {
            expect(prettierignore.split('\n')).toContain(pattern);
            const source = join(sandbox.path, 'web', path, path.endsWith('/') ? 'source.js' : '');
            const information = await prettier.getFileInfo(source, {
                ignorePath: join(sandbox.path, '.prettierignore'),
                withNodeModules: true,
                resolveConfig: false,
            });
            expect(information.ignored).toBe(true);
        }
        for (const path of absent) expect(prettierignore.split('\n')).not.toContain(path);
    },
);

test('the ignore lists name only the files that gspot writes, and Ruff gets only folders and Python files', async () => {
    await using sandbox = await createGitSandbox({
        ...IGNORE_LIST_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'python', 'markdown'], IGNORE_LIST_SETTINGS),
    });
    const session = await openSession(sandbox.path);
    const files = generateFiles(session).files;
    const written = files
        .map(({ path }) => path)
        .filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`))
        .map((path) => `/${path}`);
    const listed = buildIgnoreSections(session)
        .find(({ key }) => key === 'gspot')!
        .patterns.filter((pattern) => !pattern.startsWith(`${GSPOT_FOLDER}/`));
    expect(listed.toSorted(compareText)).toStrictEqual(written.toSorted(compareText));
    const ruff = files.find(({ path }) => path.startsWith(`${GSPOT_FOLDER}/`) && path.endsWith('ruff.toml'))!;
    const excluded = (parse(ruff.content) as { 'extend-exclude': string[] })['extend-exclude'];
    expect(excluded).toContain('../../../../.gspot/**');
    expect(excluded.filter((pattern) => !pattern.endsWith('/**') && !pattern.endsWith('.py'))).toStrictEqual([]);
});

test('a second apply writes the same files when .prettierignore covers every source file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'source/build/value.js': 'export const value = 1;\n',
        'coverage/value.js': 'export const value = 1;\n',
    });
    const outputs: string[][] = [];
    for (const _pass of [1, 2]) {
        const session = await openSession(sandbox.path);
        const output = generateFiles(session);
        const writer = openFiles(sandbox.path);
        const report = await writeGeneratedFiles(session, output, writer);
        expect(await readFile(join(sandbox.path, '.prettierignore'), 'utf8')).toBe(
            output.files.find((file) => file.path === '.prettierignore')!.content,
        );
        if (_pass === 2) expect(report.unchanged).toContain('.prettierignore');
        outputs.push(output.files.map(({ path, content }) => `${path}\n${content}`));
    }
    expect(outputs[1]).toStrictEqual(outputs[0]);
    expect(outputs[0]!.map((file) => file.split('\n', 1)[0])).toContain('.prettierignore');
});

test('root paths in the generated-files section are anchored, so an authored tools/eslint.config.mjs stays checked', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'javascript', 'duplication'], { level: 'all' }),
        'source.js': 'export const value = 1;\n',
        'tools/eslint.config.mjs': 'export default [];\n',
    });
    const output = generateFiles(await openSession(sandbox.path));
    const ignoreFile = output.files.find(({ path }) => path === '.prettierignore')!;
    expect(ignoreFile.content.split('\n')).toContain('/eslint.config.mjs');
    expect(ignoreFile.content.split('\n')).not.toContain('eslint.config.mjs');
    const ignorePath = join(sandbox.path, ignoreFile.path);
    await writeFile(ignorePath, ignoreFile.content);
    const root = await prettier.getFileInfo(join(sandbox.path, 'eslint.config.mjs'), {
        ignorePath,
        resolveConfig: false,
    });
    const authored = await prettier.getFileInfo(join(sandbox.path, 'tools/eslint.config.mjs'), {
        ignorePath,
        resolveConfig: false,
    });
    expect({ root: root.ignored, authored: authored.ignored }).toStrictEqual({ root: true, authored: false });
    const duplication = output.files.find(({ path }) => path.endsWith('/jscpd.json'))!;
    const ignored = getValueAt(JSON.parse(duplication.content), ['ignore']);
    expect(ignored).toContain('eslint.config.mjs');
    expect(ignored).not.toContain('**/eslint.config.mjs');
});

test('changing tracked gitignore patterns leaves generated tool configurations unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'spelling']),
        '.gitignore': '',
        'source.js': 'export const value = 1;\n',
    });
    runGitStep(sandbox.path, ['add', '--', 'gspot.toml', '.gitignore', 'source.js']);
    const before = generateFiles(await openSession(sandbox.path)).files.filter(({ path }) =>
        ['.prettierignore', 'typos.toml', 'knip.json', 'eslint.mjs'].some((name) => path.endsWith(name)),
    );
    expect(before).toHaveLength(4);
    await writeFile(join(sandbox.path, '.gitignore'), 'coverage/\nlogs/\n');
    const after = generateFiles(await openSession(sandbox.path)).files.filter(({ path }) =>
        ['.prettierignore', 'typos.toml', 'knip.json', 'eslint.mjs'].some((name) => path.endsWith(name)),
    );
    expect(after).toStrictEqual(before);
});
