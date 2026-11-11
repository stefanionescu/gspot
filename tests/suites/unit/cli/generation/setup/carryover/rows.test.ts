import { expect, test } from 'bun:test';

import { runInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const CARRYOVER_ROW_CASES = [
    {
        name: 'options for a markdownlint rule that gspot turns off',
        files: { '.markdownlint.jsonc': '{ "MD013": { "line_length": 120 } }', 'README.md': '# Example\n' },
        path: '.markdownlint.jsonc',
        row: { dropped: ['MD013'], reasons: [] },
    },
    {
        name: 'a markdownlint rule that gspot turns off too',
        files: { '.markdownlint.jsonc': '{ "MD013": false }', 'README.md': '# Example\n' },
        path: '.markdownlint.jsonc',
        row: { covered: 1, reasons: [] },
    },
    {
        name: 'a markdownlint-cli2 file with no rules',
        files: { '.markdownlint-cli2.jsonc': '{ "globs": ["**/*.md"] }', 'README.md': '# Example\n' },
        path: '.markdownlint-cli2.jsonc',
        row: { dropped: ['globs'] },
    },
    {
        name: 'a markdownlint rule alias',
        files: {
            '.markdownlint.json': '{ "line-length": { "line_length": 120 }, "MD033": false }',
            'README.md': '# Example\n',
        },
        path: '.markdownlint.json',
        row: { covered: 1, dropped: ['MD013'] },
    },
    {
        name: 'a markdownlint value that is no table of options',
        files: { '.markdownlint.json': '{ "MD024": "warning" }', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['MD024'] },
    },
    {
        name: 'a markdownlint rule turned on without the options of gspot',
        files: { '.markdownlint.json': '{ "MD024": true }', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['MD024'] },
    },
    {
        name: 'a markdownlint file that does not parse',
        files: { '.markdownlint.json': '{ nope', 'README.md': '# Example\n' },
        path: '.markdownlint.json',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'the Ruff quote style preserve',
        files: { 'ruff.toml': '[format]\nquote-style = "preserve"\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { dropped: ['format.quote-style'] },
    },
    {
        name: 'a Ruff file that does not parse',
        files: { 'ruff.toml': 'select = [\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a Ruff rule that a carried selector holds',
        files: { 'ruff.toml': 'select = ["E", "F", "T20"]\nignore = ["E501"]\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { carried: ['E', 'ignore E501'], reasons: [] },
    },
    {
        name: 'Ruff rules that the selector ALL holds',
        files: { 'ruff.toml': '[lint]\nselect = ["ALL"]\nignore = ["E", "D"]\n', 'main.py': 'VALUE = 1\n' },
        path: 'ruff.toml',
        row: { carried: ['ALL', 'ignore E', 'ignore D'], reasons: [] },
    },
    {
        name: 'the prettier key of package.json',
        files: {
            'package.json': '{"prettier":{"singleQuote":true,"quoteProps":"consistent"}}',
            'source.js': 'export const value = 1;\n',
        },
        path: 'package.json',
        row: { carried: ['singleQuote'], dropped: ['quoteProps'] },
    },
    {
        name: 'a shared Prettier config that package.json names',
        files: { 'package.json': '{"prettier":"@example/style"}', 'source.js': 'export const value = 1;\n' },
        path: 'package.json',
        row: { dropped: ['prettier'] },
    },
    {
        name: 'Prettier widths that gspot.toml cannot hold',
        files: { '.prettierrc.json': '{"tabWidth":0,"printWidth":100000}', 'source.js': 'export const value = 1;\n' },
        path: '.prettierrc.json',
        row: { dropped: ['tabWidth', 'printWidth'] },
    },
    {
        name: 'a package of a workspace with a value that does not fit',
        files: {
            'package.json': '{"private":true}',
            'packages/web/package.json': '{"dependencies":{"react":19}}',
            'packages/web/source.js': 'export const value = 1;\n',
        },
        path: 'packages/web/package.json',
        row: { tool: 'gspot', dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a CI file that does not parse',
        files: { '.gitlab-ci.yml': 'quality: [unterminated', 'source.js': 'export const value = 1;\n' },
        path: '.gitlab-ci.yml',
        row: { tool: 'gspot', dropped: ['the whole file, which gspot could not read'] },
    },
    {
        name: 'a package.json key under a Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":4}',
            'package.json': '{"private":true,"prettier":{"printWidth":100}}',
            'source.js': 'export const value = 1;\n',
        },
        path: 'package.json',
        row: { carried: [], dropped: ['printWidth'] },
    },
    {
        name: 'a second Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":3}',
            '.prettierrc.yaml': 'printWidth: 110\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.prettierrc.yaml',
        row: { carried: [], dropped: ['printWidth'] },
    },
    {
        name: 'an EditorConfig width under a Prettier file',
        files: {
            '.prettierrc.json': '{"tabWidth":2}',
            '.editorconfig': '[*]\nindent_size = 8\nmax_line_length = 100\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.editorconfig',
        row: { carried: ['max_line_length'], dropped: ['indent_size'] },
    },
    {
        name: 'an EditorConfig width that gspot.toml cannot hold',
        files: { '.editorconfig': '[*]\nmax_line_length = 9999\n', 'source.js': 'export const value = 1;\n' },
        path: '.editorconfig',
        row: { dropped: ['max_line_length'] },
    },
    {
        name: 'an EditorConfig indent and section',
        files: {
            '.editorconfig': '[*]\nindent_style = tab\n[*.md]\nindent_size = 4\n',
            'README.md': '# Example\n',
            'source.js': 'export const value = 1;\n',
        },
        path: '.editorconfig',
        row: { carried: ['indent_style', 'sections'], dropped: [] },
    },
    {
        name: 'a Prettier script that does not load',
        files: {
            'prettier.config.mjs': "import missing from './missing.mjs';\nexport default missing;\n",
            'source.js': 'export const value = 1;\n',
        },
        path: 'prettier.config.mjs',
        row: { dropped: ['the whole file, which gspot could not read'] },
    },
] as const;

test('init turns the ignore files into ignore records, and keeps what matches a tracked file', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierignore': '# output\ndist/\n*.min.js\nnothing-here/\n!dist/keep.js\n',
        'dist/bundle.js': 'export const a = 1;\n',
        'src/a.min.js': 'export const b = 1;\n',
    });
    const { plan, settings } = await runInit(sandbox.path);
    expect(settings['ignore']).toStrictEqual([
        {
            check: 'format/prettier',
            paths: ['**/dist/**', '**/*.min.js'],
            reason: 'Carried over from .prettierignore.',
        },
    ]);
    expect(plan.carryover.find(({ path }) => path === '.prettierignore')).toMatchObject({
        carried: ['**/dist/**', '**/*.min.js'],
        dropped: ['!dist/keep.js'],
    });
});

test.each([...CARRYOVER_ROW_CASES])('init goes on past $name, and the table names it', async ({ files, path, row }) => {
    await using sandbox = await createGitSandbox(files);
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find((each) => each.path === path)).toMatchObject(row);
});

test('init goes on past a nested package.json that does not parse, and it marks no scope', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}\n',
        'source.js': 'export const value = 1;\n',
        'tests/fixtures/broken/package.json': '{ nope',
        'tests/fixtures/local/pyproject.toml': '[project]\ndependencies = ["./vendor/lib"]\n',
        'tests/fixtures/numbers/package.json': '{"scripts":{"build":1}}',
    });
    const { settings } = await runInit(sandbox.path);
    expect(settings['scope']).toMatchObject([{ path: 'tests/fixtures/numbers' }]);
});

test('init sends the rules of an ESLint config to gspot scan, which can compare them', async () => {
    await using sandbox = await createGitSandbox({
        'eslint.config.mjs': 'export default [];\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'src/a.js': 'export const a = 1;\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === 'eslint.config.mjs')).toMatchObject({
        tool: 'eslint',
        dropped: ['its rules; gspot scan compares them before init'],
    });
});

test('init names each replaced config that it does not read', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F"]\n',
        'tools/.ruff.toml': '[lint]\nselect = ["AIR"]\n',
        'tools/main.py': 'VALUE = 1\n',
        'sample/.prettierrc': '{"semi":false}\n',
        'sample/source.js': 'export const value = 1;\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.filter(({ path }) => path !== 'ruff.toml')).toMatchObject([
        { path: 'sample/.prettierrc', dropped: [expect.stringContaining('init does not read this config')] },
        { path: 'tools/.ruff.toml', dropped: [expect.stringContaining('init does not read this config')] },
    ]);
});

test('init names the words of a replaced typos config, which it drops', async () => {
    await using sandbox = await createGitSandbox({
        'typos.toml': '[default.extend-words]\nNebulix = "Nebulix"\n',
        'README.md': '# Example\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.deleted.map(({ path }) => path)).toContain('typos.toml');
    expect(plan.carryover).toMatchObject([
        { path: 'typos.toml', tool: 'typos', dropped: [expect.stringContaining('spelling.allowed_words')] },
    ]);
});
