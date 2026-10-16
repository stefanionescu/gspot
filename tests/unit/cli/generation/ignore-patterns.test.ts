import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { valueAt } from '#cli/system/values.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitFile } from '#tests/setup/generate.ts';
import { openSession } from '#cli/commands/session.ts';
import { scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';

import {
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    SCOPE_PATTERN_CASES,
    PRETTIER_IGNORE_CASES,
    PRETTIER_IGNORE_SETTINGS,
    PRETTIER_IGNORE_ATTRIBUTES,
} from '#tests/config/ignore-patterns.ts';

test.each([...PRETTIER_IGNORE_CASES])(
    'the generated .prettierignore ignores $file: $ignored',
    async ({ file, ignored }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': stringify(PRETTIER_IGNORE_SETTINGS),
            '.gitattributes': PRETTIER_IGNORE_ATTRIBUTES,
            'package.json': '{"packageManager":"pnpm@9.0.0"}',
            'source.ts': 'export const value = 1;\n',
            [file]: 'const value={enabled:true};\n',
        });
        const generated = emitAll(await openSession(directory.path)).files.find(
            ({ path }) => path === '.prettierignore',
        )!;
        const ignorePath = join(directory.path, generated.path);
        await Bun.write(ignorePath, generated.content);
        const result = await prettier.getFileInfo(join(directory.path, file), { ignorePath, resolveConfig: false });
        expect(result).toStrictEqual({ ignored, inferredParser: ignored ? null : 'typescript' });
    },
);

test.each([...SCOPE_PATTERN_CASES])(
    'scope projection keeps brace and escape meaning for $pattern',
    ({ pattern, expected }) => {
        expect(scopeIgnorePatterns([pattern], 'apps/web')).toStrictEqual([...expected]);
    },
);

test('scope projection keeps exclusion order and leaves other scopes out', () => {
    expect(scopeIgnorePatterns(['/apps/web/{a,b}.ts', '!/apps/web/a.ts'], 'apps/web')).toStrictEqual([
        '/a.ts',
        '/b.ts',
        '!/a.ts',
    ]);
    expect(scopeIgnorePatterns(['/{apps,packages}/web/file.ts'], 'services/web')).toStrictEqual([]);
    expect(scopeIgnorePatterns(['# comment', '', '**/generated/'], '')).toStrictEqual([
        '# comment',
        '',
        '**/generated/',
    ]);
});

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
        const content = await emitFile(settings, path, { 'source.js': 'export const port = 8080;\n' });
        const parsed = path.endsWith('.toml') ? parse(content) : (JSON.parse(content) as unknown);
        const patterns = valueAt(parsed, nativePath);
        expect(patterns).toContain('selected/**');
        expect(patterns).not.toContain('rule-only/**');
        expect(patterns).not.toContain('other/**');
    },
);

test.each(['', 'api'])('.semgrepignore in scope "%s" lists only that scope\'s Semgrep path ignores', async (scope) => {
    const settings = stringify({
        configurations: ['javascript'],
        scope: [{ path: 'api', configurations: ['javascript'] }],
        ignore: [
            {
                check: 'security/semgrep',
                paths: ['api/local/**'],
                reason: 'These local sources have their own security owner.',
            },
            {
                check: 'security/semgrep',
                rule: 'example-rule',
                paths: ['api/rule-only/**'],
                reason: 'This one rule has a reviewed false positive.',
            },
            {
                check: 'security/semgrep-registry',
                paths: ['api/registry-only/**'],
                reason: 'Only registry findings are accepted here.',
            },
        ],
    });
    const content = await emitFile(settings, scope === '' ? '.semgrepignore' : `${scope}/.semgrepignore`, {
        'source.js': 'export {};\n',
        'api/source.js': 'export {};\n',
    });
    expect(content.split('\n')).toContain(scope === '' ? 'api/local/**' : '/local/**');
    expect(content).not.toContain('rule-only');
    expect(content).not.toContain('registry-only');
});

test.each([...LANGUAGE_IGNORES])(
    "$name: Prettier ignores only the selected languages' folders, with pointers where JavaScript is selected",
    async ({ settings, ignored, absent, pointer, markdownPointer }) => {
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
        const files = new Map(emitAll(session).files.map(({ path, content }) => [path, content]));
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
        expect(files.has('prettier.config.mjs')).toBe(pointer);
        expect(files.has('.markdownlint-cli2.mjs')).toBe(markdownPointer === '.markdownlint-cli2.mjs');
        if (markdownPointer !== '') expect(files.has(markdownPointer)).toBe(true);
        expect(files.has('.prettierignore')).toBe(true);
        expect(files.has('.gspot/config/prettierignore')).toBe(false);
    },
);
