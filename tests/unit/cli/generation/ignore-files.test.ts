import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/values.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { generateFile } from '#tests/setup/tool-files.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildIgnoreSections } from '#cli/generation/ignore-files.ts';
import { IGNORE_SECTION_TITLES } from '#cli/config/generation/ignore-files.ts';

import {
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    PRETTIER_IGNORE_CASES,
    IGNORE_LIST_REPOSITORY,
    PRETTIER_IGNORE_SETTINGS,
    PRETTIER_IGNORE_ATTRIBUTES,
} from '#tests/data/generation/ignore-files.ts';

test.each([...PRETTIER_IGNORE_CASES])(
    'the generated .prettierignore ignores $file: $ignored',
    async ({ file, ignored }) => {
        await using folder = await testdir();
        await createFileTree(folder.path, {
            'gspot.toml': stringify(PRETTIER_IGNORE_SETTINGS),
            '.gitattributes': PRETTIER_IGNORE_ATTRIBUTES,
            'package.json': '{"packageManager":"pnpm@9.0.0"}',
            'source.ts': 'export const value = 1;\n',
            [file]: 'const value={enabled:true};\n',
        });
        const generated = generate(await openSession(folder.path)).files.find(
            ({ path }) => path === '.prettierignore',
        )!;
        const ignorePath = join(folder.path, generated.path);
        await Bun.write(ignorePath, generated.content);
        const result = await prettier.getFileInfo(join(folder.path, file), { ignorePath, resolveConfig: false });
        expect(result).toStrictEqual({ ignored, inferredParser: ignored ? null : 'typescript' });
    },
);

test.each([...PATH_IGNORE_CASES])(
    '$check: a check-wide path ignore reaches the tool file and a rule or other-check ignore does not',
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
    "$name: Prettier ignores only the selected languages' folders, and a markdownlint pointer at the root",
    async ({ settings, ignored, absent }) => {
        await using sandbox = await testdir({
            'gspot.toml': `level = "all"\n${settings}`,
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
        await Bun.write(join(sandbox.path, '.prettierignore'), internal);
        for (const path of ignored) {
            expect(internal.split('\n')).toContain(path);
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
        expect(files.has('.gspot/configurations/general/format/.prettierignore')).toBe(false);
    },
);

test('the ignore lists name only the files that gspot writes, and Ruff gets only folders and Python files', async () => {
    await using sandbox = await testdir(IGNORE_LIST_REPOSITORY);
    readGitOutput(sandbox.path, ['init', '-q']);
    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const written = files.map(({ path }) => path).filter((path) => !path.startsWith('.gspot/'));
    const listed = buildIgnoreSections(session)
        .find(({ title }) => title === IGNORE_SECTION_TITLES.gspot)!
        .patterns.filter((pattern) => !pattern.startsWith('.gspot/'));
    expect(listed.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        written.toSorted((left, right) => left.localeCompare(right)),
    );
    const ruff = files.find(({ path }) => path.startsWith('.gspot/') && path.endsWith('ruff.toml'))!;
    const excluded = (parse(ruff.content) as { 'extend-exclude': string[] })['extend-exclude'];
    expect(excluded.length).toBeGreaterThan(0);
    for (const pattern of excluded) expect(pattern.endsWith('/**') || pattern.endsWith('.py')).toBe(true);
});

test('a second apply writes the same files when .prettierignore covers every source file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['javascript'], { level: 'all' }),
        'source/build/value.js': 'export const value = 1;\n',
        'coverage/value.js': 'export const value = 1;\n',
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    const outputs: string[][] = [];
    for (const _pass of [1, 2]) {
        const session = await openSession(sandbox.path);
        const output = generate(session);
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, output, log);
        outputs.push(output.files.map(({ path, content }) => `${path}\n${content}`));
    }
    expect(outputs[1]).toStrictEqual(outputs[0]);
    expect(outputs[0]!.some((file) => file.startsWith('.prettierignore\n'))).toBe(true);
});
