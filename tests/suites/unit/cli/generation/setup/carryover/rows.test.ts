import { test, expect } from 'bun:test';
import { runInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { CARRYOVER_ROW_CASES } from '#tests/config/generation/carryover.ts';

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
