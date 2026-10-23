import prettier from 'prettier';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { generateFile } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';

import {
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    PRETTIER_IGNORE_CASES,
    IGNORE_LIST_REPOSITORY,
    PRETTIER_IGNORE_SETTINGS,
    PRETTIER_IGNORE_ATTRIBUTES,
} from '#tests/config/generation/config-files/ignore-files.ts';

test.each([...PRETTIER_IGNORE_CASES])(
    'the generated .prettierignore ignores $file: $ignored',
    async ({ file, ignored }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(PRETTIER_IGNORE_SETTINGS.configurations, {
                rules: true,
                tables: stringify({ ignore: PRETTIER_IGNORE_SETTINGS.ignore }),
            }),
            '.gitattributes': PRETTIER_IGNORE_ATTRIBUTES,
            'package.json': '{"packageManager":"pnpm@9.0.0"}',
            'source.ts': 'export const value = 1;\n',
            [file]: 'const value={enabled:true};\n',
        });

        const generated = generate(await openSession(sandbox.path)).files.find(
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
    async ({ configuration, check, path, nativePath }) => {
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
    async ({ settings, ignored, absent }) => {
        await using sandbox = await testdir({
            'gspot.toml': settings,
            'source.js': 'const value = 1;\n',
            'source.py': 'value = 1\n',
            'Source.swift': 'let value = 1\n',
            'readme.md': '# Example\n',
            'web/source.js': 'const value = 1;\n',
            'web/readme.md': '# Example\n',
        });
        const session = await openSession(sandbox.path);
        const files = new Map(generate(session).files.map(({ path, content }) => [path, content]));
        const internal = files.get('.prettierignore')!;
        await writeFile(join(sandbox.path, '.prettierignore'), internal);
        for (const { path, pattern } of ignored) {
            expect(internal.split('\n')).toContain(pattern);
            const source = join(sandbox.path, 'web', path, path.endsWith('/') ? 'source.js' : '');
            const information = await prettier.getFileInfo(source, {
                ignorePath: join(sandbox.path, '.prettierignore'),
                withNodeModules: true,
                resolveConfig: false,
            });
            expect(information.ignored).toBe(true);
        }
        for (const path of absent) expect(internal.split('\n')).not.toContain(path);
        expect(files.has('prettier.config.mjs')).toBe(true);
        expect(files.has('.markdownlint.jsonc')).toBe(true);
        expect(files.has('.prettierignore')).toBe(true);
        expect(files.has(`${GSPOT_PATHS.configurations}/general/format/.prettierignore`)).toBe(false);
    },
);

test('the ignore lists name only the files that gspot writes, and Ruff gets only folders and Python files', async () => {
    await using sandbox = await testdir(IGNORE_LIST_REPOSITORY);
    runGitStep(sandbox.path, ['init', '-q']);
    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const written = files
        .map(({ path }) => path)
        .filter((path) => !path.startsWith(`${DOT_GSPOT}/`))
        .map((path) => `/${path}`);
    const listed = buildIgnoreSections(session)
        .find(({ key }) => key === 'gspot')!
        .patterns.filter((pattern) => !pattern.startsWith(`${DOT_GSPOT}/`));
    expect(listed.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        written.toSorted((left, right) => left.localeCompare(right)),
    );
    const ruff = files.find(({ path }) => path.startsWith(`${DOT_GSPOT}/`) && path.endsWith('ruff.toml'))!;
    const excluded = (parse(ruff.content) as { 'extend-exclude': string[] })['extend-exclude'];
    expect(excluded.length).toBeGreaterThan(0);
    for (const pattern of excluded) expect(pattern).toMatch(/(?:\/\*\*|\.py)$/u);
});

test('a second apply writes the same files when .prettierignore covers every source file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'source/build/value.js': 'export const value = 1;\n',
        'coverage/value.js': 'export const value = 1;\n',
    });
    runGitStep(sandbox.path, ['init', '-q']);
    const outputs: string[][] = [];
    for (const _pass of [1, 2]) {
        const session = await openSession(sandbox.path);
        const output = generate(session);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, output, writer);
        outputs.push(output.files.map(({ path, content }) => `${path}\n${content}`));
    }
    expect(outputs[1]).toStrictEqual(outputs[0]);
    expect(outputs[0]!.map((file) => file.split('\n', 1)[0])).toContain('.prettierignore');
});

test('config files leave out what the tracked .gitignore files ignore, apart from patterns that match a tracked file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'javascript']),
        '.gitignore': '.open-next/\n# A comment\n!keep.log\n.env*\n',
        'app/.gitignore': 'other/\n/generated/types\n',
        '.env.example': 'TOKEN=\n',
        'app/main.py': 'value = 1\n',
        'entry.js': 'export const value = 1;\n',
    });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, [
        'add',
        '-f',
        '--',
        '.gitignore',
        'app/.gitignore',
        '.env.example',
        'app/main.py',
        'entry.js',
    ]);
    const session = await openSession(sandbox.path);
    const section = buildIgnoreSections(session).find(({ key }) => key === 'git')!;
    expect(section.patterns).toStrictEqual(['.open-next/', '/app/**/other/', '/app/generated/types']);
    const pyright = generate(session).files.find(({ path }) => path.endsWith('basedpyright.json'))!;
    const excluded = (JSON.parse(pyright.content) as { exclude: string[] }).exclude;
    expect(excluded).toStrictEqual(
        [
            '**/.open-next/**',
            'app/**/other/**',
            `${DOT_GSPOT}/**`,
            '**/.venv/**',
            '**/venv/**',
            '**/node_modules/**',
            '**/bower_components/**',
        ].map((pattern) => `../../../../${pattern}`),
    );
});

test('root paths in the generated-files section are anchored, so an authored tools/eslint.config.mjs stays checked', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'javascript', 'duplication'], { level: 'all' }),
        'source.js': 'export const value = 1;\n',
        'tools/eslint.config.mjs': 'export default [];\n',
    });
    const output = generate(await openSession(sandbox.path));
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
