import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import prettier from 'prettier';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import {
    IGNORE_LIST_FILES,
    IGNORE_LIST_SETTINGS,
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    PRETTIER_IGNORE_CASES,
    PRETTIER_IGNORE_SETTINGS,
} from '#tests/config/generation/files.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('negative ignores follow positives for ordered tools and stay out of tools without negation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'format', 'spelling'], {
            level: 'all',
            tables: '[[ignore]]\npaths = ["!src/keep.ts", "src/**"]\nreason = "Keep one authored file among generated sources."\n',
        }),
        'src/keep.ts': 'export const kept = 1;\n',
        'src/omit.ts': 'export const omitted = 1;\n',
    });
    const output = buildGeneratedFiles(await openSession(sandbox.path));
    const prettierIgnore = output.files.find(({ path }) => path === '.prettierignore')!.content;
    await writeFile(join(sandbox.path, '.prettierignore'), prettierIgnore);
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
    const paths = findValueAt(typos, ['files', 'extend-exclude']) as string[];
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
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    const prettierIgnore = generated.files.find(({ path }) => path === '.prettierignore')!.content;
    const typos = generated.files.find(({ path }) => path.endsWith('/typos.toml'))!.content;
    const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!.body;
    for (const text of [prettierIgnore, typos]) {
        expect(text.includes('.github/workflows/gspot.yml')).toBe(enabled);
    }
    expect(attributes).not.toContain('.github/workflows/gspot.yml');
    expect(attributes).toContain('.gspot/hooks/** linguist-generated=false');
});

test('shared Markdown settings leave inherited pointer files out of generated path ignores', async () => {
    await using sandbox = await createGitSandbox({
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
    const ignored = buildIgnoreSections(session, buildConfigs(session)).find(({ key }) => key === 'gspot')!.patterns;
    expect(ignored.filter((path) => path.endsWith('.markdownlint.jsonc'))).toStrictEqual(['/.markdownlint.jsonc']);
});

test('a Markdown scope with no root config keeps its pointer file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'app', configurations: ['markdown'] }] }),
        'app/README.md': '# App\n',
    });
    const session = await openSession(sandbox.path);
    const ignored = buildIgnoreSections(session, buildConfigs(session)).find(({ key }) => key === 'gspot')!.patterns;
    expect(ignored.filter((path) => path.endsWith('.markdownlint.jsonc'))).toStrictEqual(['/app/.markdownlint.jsonc']);
});

test.each([...PRETTIER_IGNORE_CASES])(
    'the generated .prettierignore ignores $file: $ignored',
    async ({ file, ignored }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(PRETTIER_IGNORE_SETTINGS.configurations, {
                rules: true,
                tables: stringify({ ignore: PRETTIER_IGNORE_SETTINGS.ignore }),
            }),
            '.gitattributes': '/generated/** linguist-generated\n/vendored/** linguist-vendored\n',
            'package.json': '{"packageManager":"pnpm@9.0.0"}',
            'source.ts': 'export const value = 1;\n',
            [file]: 'const value={enabled:true};\n',
        });

        const generated = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
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
        const content = await buildGeneratedFile(settings, path, { 'source.js': 'export const port = 8080;\n' });
        const parsed: unknown = path.endsWith('.toml') ? parse(content) : (JSON.parse(content) as unknown);
        const patterns = findValueAt(parsed, nativePath);
        expect(patterns).toContain('selected/**');
        expect(patterns).not.toContain('rule-only/**');
        expect(patterns).not.toContain('other/**');
    },
);

test.each([...LANGUAGE_IGNORES])(
    '$name: Prettier ignores only the folders of the selected languages',
    async ({ configurations, scopes, ignored, absent }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(configurations, { rules: true, scopes }),
            'source.js': 'const value = 1;\n',
            'source.py': 'value = 1\n',
            'Source.swift': SWIFT_VALUE_SOURCE,
            'readme.md': '# Example\n',
            'web/source.js': 'const value = 1;\n',
            'web/readme.md': '# Example\n',
        });
        const session = await openSession(sandbox.path);
        const files = new Map(buildGeneratedFiles(session).files.map(({ path, content }) => [path, content]));
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
    const files = buildGeneratedFiles(session).files;
    const written = files
        .map(({ path }) => path)
        .filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`))
        .map((path) => `/${path}`);
    const listed = buildIgnoreSections(session, buildConfigs(session))
        .find(({ key }) => key === 'gspot')!
        .patterns.filter((pattern) => !pattern.startsWith(`${GSPOT_FOLDER}/`));
    expect(listed.toSorted(compareText)).toStrictEqual(
        [...written, '.gspot-copies/**', 'gspot.baseline.json'].toSorted(compareText),
    );
    const ruff = files.find(({ path }) => path.startsWith(`${GSPOT_FOLDER}/`) && path.endsWith('ruff.toml'))!;
    const excluded = (parse(ruff.content) as { 'extend-exclude': string[] })['extend-exclude'];
    expect(excluded).toContain('../../../../.gspot/**');
    expect(excluded).toContain('../../../../.gspot-copies/**');
    expect(excluded.filter((pattern) => !pattern.endsWith('/**') && !pattern.endsWith('.py'))).toStrictEqual([]);
});

test('each submodule checkout gets an ignore pattern of its own', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['javascript']) });
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},vendor/library`]);
    const session = await openSession(sandbox.path);
    expect(
        buildIgnoreSections(session, buildConfigs(session)).find(({ key }) => key === 'submodules')?.patterns,
    ).toStrictEqual(['/vendor/library/']);
});

test('a second write of the generated files gives the same files when .prettierignore covers every source file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'source/build/value.js': 'export const value = 1;\n',
        'coverage/value.js': 'export const value = 1;\n',
    });
    const outputs: string[][] = [];
    for (const _pass of [1, 2]) {
        const session = await openSession(sandbox.path);
        const output = buildGeneratedFiles(session);
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format', 'javascript'], { level: 'all' }),
        'source.js': 'export const value = 1;\n',
        'tools/eslint.config.mjs': 'export default [];\n',
    });
    const output = buildGeneratedFiles(await openSession(sandbox.path));
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
    const jscpd = output.files.find(({ path }) => path.endsWith('/jscpd.json'))!;
    const ignored = findValueAt(JSON.parse(jscpd.content), ['ignore']);
    expect(ignored).toContain('eslint.config.mjs');
    expect(ignored).not.toContain('**/eslint.config.mjs');
});

test('the generated tool configs leave out what the tracked .gitignore files ignore', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'spelling']),
        '.gitignore': 'other/\n',
        'main.py': 'VALUE = 1\n',
    });
    runGitStep(sandbox.path, ['add', '--', 'gspot.toml', '.gitignore', 'main.py']);
    const { files } = buildGeneratedFiles(await openSession(sandbox.path));
    const pyright = JSON.parse(files.find(({ path }) => path.endsWith('/basedpyright.json'))!.content) as {
        exclude: string[];
    };
    expect(pyright.exclude).toContain('../../../../**/other/**');
    const typos: unknown = parse(files.find(({ path }) => path.endsWith('/typos.toml'))!.content);
    expect(findValueAt(typos, ['files', 'extend-exclude'])).toContain('**/other/**');
});
