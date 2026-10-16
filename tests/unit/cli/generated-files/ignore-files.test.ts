import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { getValueAt } from '#cli/system/values.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { generateFile } from '#tests/setup/tool-files.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildToolFile } from '#cli/generation/tool-files/build.ts';
import type { WholeToolFile } from '#cli/types/generation/files.ts';

import {
    LANGUAGE_IGNORES,
    PATH_IGNORE_CASES,
    SCOPE_PATTERN_CASES,
    PRETTIER_IGNORE_CASES,
    PRETTIER_IGNORE_SETTINGS,
    PRETTIER_IGNORE_ATTRIBUTES,
} from '#tests/data/generated-files/ignore-files.ts';

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

/** Build a declared scoped ignore output from an actual repository and selected tool. */
async function generateIgnoreFile(settings: string, files: Record<string, string>, scope: string): Promise<string> {
    await using sandbox = await testdir({ ...files, 'gspot.toml': settings });
    const session = await openSession(sandbox.path);
    const manifest = session.manifests.get('security')!;
    const toolFile = manifest.toolFiles
        .filter((file): file is WholeToolFile => !file.fragment && file.source !== undefined)
        .find(({ target }) => target === '.semgrepignore')!;
    return buildToolFile(
        {
            session,
            manifest,
            toolFile,
            scopes: session.scopes,
            files: session.repository.files,
            manifests: session.neededToolManifests,
            selection: session.scopes.find(({ scope: selected }) => selected.path === scope)!,
            targetPath: `${scope}/.semgrepignore`,
            level: session.settingsFile.settings.level,
        },
        session.toolFiles().targets,
    ).content;
}

/** Read one public ignore section without the generated comments around it. */
function readIgnoreSection(content: string, title: string): string[] {
    const section = content.split(`# ${title}\n`, 2)[1];
    return section === undefined ? [] : section.split('\n\n', 1)[0]!.trimEnd().split('\n');
}

test.each([...SCOPE_PATTERN_CASES])(
    'scope projection keeps brace and escape meaning for $pattern',
    async ({ pattern, expected }) => {
        const settings = stringify({
            configurations: ['javascript'],
            scope: [{ path: 'apps/web', configurations: ['javascript'] }],
        });
        const content = await generateIgnoreFile(
            settings,
            {
                '.gitattributes': `${JSON.stringify(pattern)} linguist-generated\n`,
                'apps/web/source.js': 'export {};\n',
            },
            'apps/web',
        );
        expect(readIgnoreSection(content, 'Generator outputs')).toStrictEqual([...expected]);
    },
);

test('scope projection keeps exclusion order and leaves other scopes out', async () => {
    const reason = 'These generated sources have a separate security owner.';
    const settings = {
        configurations: ['javascript'],
        scope: [
            { path: 'apps/web', configurations: ['javascript'] },
            { path: 'services/web', configurations: ['javascript'] },
        ],
        ignore: [{ check: 'security/semgrep', paths: ['apps/web/{a,b}.ts', '!apps/web/a.ts'], reason }],
    };
    const files = { 'apps/web/source.js': 'export {};\n', 'services/web/source.js': 'export {};\n' };
    const selected = await generateIgnoreFile(stringify(settings), files, 'apps/web');
    expect(readIgnoreSection(selected, reason)).toStrictEqual(['/a.ts', '/b.ts', '!/a.ts']);
    const other = await generateIgnoreFile(
        stringify({
            ...settings,
            ignore: [{ check: 'security/semgrep', paths: ['{apps,packages}/web/file.ts'], reason }],
        }),
        files,
        'services/web',
    );
    expect(readIgnoreSection(other, reason)).toStrictEqual([]);
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
        const content = await generateFile(settings, path, { 'source.js': 'export const port = 8080;\n' });
        const parsed: unknown = path.endsWith('.toml') ? parse(content) : (JSON.parse(content) as unknown);
        const patterns = getValueAt(parsed, nativePath);
        expect(patterns).toContain('selected/**');
        expect(patterns).not.toContain('rule-only/**');
        expect(patterns).not.toContain('other/**');
    },
);

test('.semgrepignore lists repository-relative Semgrep path ignores', async () => {
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
    const content = await generateFile(settings, '.semgrepignore', {
        'source.js': 'export {};\n',
        'api/source.js': 'export {};\n',
    });
    expect(content.split('\n')).toContain('api/local/**');
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
        expect(files.has('prettier.config.mjs')).toBe(pointer);
        expect(files.has('.markdownlint-cli2.mjs')).toBe(markdownPointer === '.markdownlint-cli2.mjs');
        if (markdownPointer !== '') expect(files.has(markdownPointer)).toBe(true);
        expect(files.has('.prettierignore')).toBe(true);
        expect(files.has('.gspot/config/prettierignore')).toBe(false);
    },
);
