import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/system/git.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import type { InitJson } from '#cli/types/commands/edits.ts';
import { CARRY_ROW_CASES } from '#tests/config/generation/carry.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function runInit(
    root: string,
    commandArguments: string[] = [],
): Promise<Required<Pick<InitJson, 'plan'>> & { settings: TomlTable }> {
    commitAll(root);
    const result = await runGspot(root, ['init', '--json', ...commandArguments]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settingsText } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'settingsText'>>;
    return { plan, settings: parse(settingsText) as TomlTable };
}

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
    expect(plan.carry.find(({ path }) => path === '.prettierignore')).toMatchObject({
        carried: ['**/dist/**', '**/*.min.js'],
        dropped: ['!dist/keep.js'],
    });
});

test('init adds the Ruff rules that gspot does not run, and names each rule that needs a reason', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml':
            'extend-exclude = ["vendor"]\n[lint]\nselect = ["F", "AIR"]\nignore = ["F401"]\n[lint.per-file-ignores]\n"tests/*" = ["F811"]\n',
        'main.py': 'VALUE = 1\n',
        'vendor/other.py': 'VALUE = 2\n',
    });
    const { plan, settings } = await runInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['tools']).toStrictEqual({ ruff: { rules: ['AIR'] } });
    expect(settings['ignore']).toStrictEqual([
        { check: 'python/ruff', paths: ['**/vendor/**'], reason: 'Carried over from ruff.toml.' },
        { check: 'python/ruff-format', paths: ['**/vendor/**'], reason: 'Carried over from ruff.toml.' },
    ]);
    expect(plan.carry.find(({ path }) => path === 'ruff.toml')).toMatchObject({
        covered: 1,
        carried: ['AIR', '**/vendor/**'],
        reasons: [
            'gspot ignore python/ruff --rule F401 --reason "<why>"',
            'gspot ignore python/ruff --rule F811 --paths \'tests/*\' --reason "<why>"',
        ],
    });
});

test('init compares the markdownlint table with what gspot runs', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': JSON.stringify({ MD018: true, MD001: false, MD024: { siblings_only: false } }),
        'README.md': '# Example\n',
    });
    const { plan, settings } = await runInit(sandbox.path);
    expect(settings['tools']).toStrictEqual({ markdownlint: { rules: { MD024: { siblings_only: false } } } });
    expect(plan.carry.find(({ path }) => path === '.markdownlint.json')).toMatchObject({
        covered: 1,
        carried: ['MD024'],
        reasons: ['gspot ignore markdown/markdownlint --rule MD001 --reason "<why>"'],
    });
});

test('init compares the rules that the commitlint of the repository prints', async () => {
    await using sandbox = await createGitSandbox({
        '.commitlintrc.json': '{}\n',
        '.gitignore': 'node_modules\n',
        'README.md': '# Example\n',
    });
    const printed = {
        rules: {
            'type-empty': [2, 'never'],
            'body-leading-blank': [0],
            'header-max-length': [2, 'always', 100],
            'subject-case': [2, 'always', 'lower-case'],
            'body-max-length': [2, 'always', 900],
        },
    };
    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    const program = join(sandbox.path, 'node_modules/.bin/commitlint');
    await writeFile(program, `#!/bin/sh\necho '${JSON.stringify(printed)}'\n`);
    await chmod(program, 0o755);
    const { plan, settings } = await runInit(sandbox.path, ['--level', 'all']);
    expect(settings['tools']).toStrictEqual({
        commitlint: { rules: { 'subject-case': ['always', 'lower-case'] } },
    });
    expect(plan.carry.find(({ path }) => path === '.commitlintrc.json')).toMatchObject({
        covered: 1,
        carried: ['subject-case'],
        reasons: [
            'gspot ignore commits/commitlint --rule body-leading-blank --reason "<why>"',
            'gspot ignore commits/commitlint --rule header-max-length --reason "<why>"',
        ],
        dropped: ['body-max-length'],
    });
});

test.each([...CARRY_ROW_CASES])('init goes on past $name, and the table names it', async ({ files, path, row }) => {
    await using sandbox = await createGitSandbox(files);
    const { plan } = await runInit(sandbox.path);
    expect(plan.carry.find((each) => each.path === path)).toMatchObject(row);
});

test('init keeps commitlint options out of a rule that the generated config turns off', async () => {
    await using sandbox = await createGitSandbox({
        '.commitlintrc.json': '{}\n',
        '.gitignore': 'node_modules\n',
        'app/package.json': '{"private":true}\n',
        'README.md': '# Example\n',
    });
    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    const program = join(sandbox.path, 'node_modules/.bin/commitlint');
    await writeFile(program, `#!/bin/sh\necho '{"rules":{"scope-case":[2,"always","lower-case"]}}'\n`);
    await chmod(program, 0o755);
    const { plan } = await runInit(sandbox.path, ['--level', 'all']);
    expect(plan.carry.find(({ path }) => path === '.commitlintrc.json')).toMatchObject({ dropped: ['scope-case'] });
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
    expect(plan.carry.find(({ path }) => path === 'eslint.config.mjs')).toMatchObject({
        tool: 'eslint',
        dropped: ['its rules; gspot scan compares them before init'],
    });
});

test('init names the Prettier options that no setting holds', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierrc.json': '{"semi":false,"quoteProps":"consistent"}',
        'source.ts': 'export {};\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carry.find(({ path }) => path === '.prettierrc.json')).toMatchObject({
        carried: ['semi'],
        dropped: ['quoteProps'],
    });
});

test('init keeps the format overrides of a scope', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["app"]}',
        'app/package.json': '{"private":true}',
        'app/.editorconfig': '[*.md]\nindent_size = 4\n',
        'app/README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await runInit(sandbox.path);
    expect(settings['scope']).toMatchObject([
        { path: 'app', format: { override: [{ paths: ['**/*.md'], indent_width: 4 }] } },
    ]);
});

test('init leaves out an EditorConfig indent style of unset', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nindent_style = space\n[vendor/**]\nindent_style = unset\nindent_size = 3\n',
        'vendor/a.js': 'export const a = 1;\n',
    });
    const { settings } = await runInit(sandbox.path);
    expect((settings['format'] as TomlTable)['override']).toStrictEqual([{ paths: ['vendor/**'], indent_width: 3 }]);
});
