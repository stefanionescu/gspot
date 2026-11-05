import { expect, spyOn, test } from 'bun:test';

import { listLintCommands } from '#cli/repository/lint-commands.ts';
import type { LintCommand } from '#cli/types/repository.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function listRows(root: string): Promise<LintCommand[]> {
    const { files } = await readTestRepository(root);
    const tools = new Set(['eslint', 'prettier', 'ruff', 'basedpyright']);
    return listLintCommands({ root, files, tools, pins: { eslint: '10.13.0' } });
}

test('lint commands: a script names its line, and a hook or CI step that runs the script counts', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify(
            { scripts: { lint: 'eslint .', all: 'npm run lint', build: 'tsc -b' } },
            null,
            2,
        ),
        '.husky/pre-commit': '# the lint\nnpm run lint\n',
        '.github/workflows/check.yml':
            'jobs:\n  lint:\n    steps:\n      - name: run eslint\n        uses: actions/checkout@v4\n      - run: |\n          npm ci\n          bun run lint\n',
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ file, line, source, command, tool }) => [file, line, source, command, tool])).toStrictEqual([
        ['package.json', 3, 'script', 'eslint .', 'eslint'],
        ['package.json', 4, 'script', 'npm run lint', 'eslint'],
        ['.github/workflows/check.yml', 8, 'ci', 'bun run lint', 'eslint'],
        ['.husky/pre-commit', 2, 'hook', 'npm run lint', 'eslint'],
    ]);
});

test('lint commands: a lint-staged entry counts, and so does the hook line that starts lint-staged', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ 'lint-staged': { '*.ts': ['eslint --fix', 'vitest related'] } }),
        '.lintstagedrc.mjs': "export default { '*.css': 'prettier --write' };\n",
        '.husky/pre-commit': 'npx lint-staged\n',
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ source, tool }) => [source, tool])).toStrictEqual([
        ['lint-staged', 'eslint'],
        ['lint-staged', 'prettier'],
        ['hook', 'lint-staged'],
    ]);
});

test('lint commands: a lint-staged entry names its own line when a script runs the same command', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify(
            { scripts: { format: 'prettier --write' }, 'lint-staged': { '*.ts': 'prettier --write' } },
            null,
            2,
        ),
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ line, source }) => [line, source])).toStrictEqual([
        [3, 'script'],
        [6, 'lint-staged'],
    ]);
});

test('lint commands: a pre-commit entry counts by its id, and a CI step that runs pre-commit', async () => {
    await using sandbox = await createGitSandbox({
        '.pre-commit-config.yaml':
            'repos:\n  - repo: https://github.com/astral-sh/ruff-pre-commit\n    hooks:\n      - id: ruff-format\n      - id: mypy\n',
        '.gitlab-ci.yml': 'lint:\n  script:\n    - pre-commit run --all-files\n',
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ source, tool }) => [source, tool])).toStrictEqual([
        ['pre-commit', 'ruff'],
        ['ci', 'pre-commit'],
    ]);
});

test('lint commands: each pre-commit hook gives one row at the line of its id', async () => {
    await using sandbox = await createGitSandbox({
        '.pre-commit-config.yaml': `ci:
  skip: [ruff, prettier]
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    hooks:
      - id: ruff
      - id: ruff
  - repo: local
    hooks:
      - id: local-prettier
        entry: npx prettier --write
      - id: eslint
        entry: npm run lint:files
`,
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ line, command, tool }) => [line, command, tool])).toStrictEqual([
        [6, 'ruff', 'ruff'],
        [7, 'ruff', 'ruff'],
        [10, 'npx prettier --write', 'prettier'],
        [12, 'npm run lint:files', 'eslint'],
    ]);
});

test('lint commands: a hook id or a pygrep pattern that only names a tool gives no row', async () => {
    await using sandbox = await createGitSandbox({
        '.pre-commit-config.yaml': `repos:
  - repo: local
    hooks:
      - id: check-eslint-settings
        entry: ./scripts/check_settings.py
      - id: inclusive-language
        language: pygrep
        entry: (black|white)list|eslint
`,
    });
    expect(await listRows(sandbox.path)).toStrictEqual([]);
});

test('lint commands: a devDependency names its own line, and not a script that calls the same tool', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify(
            { scripts: { lint: 'eslint' }, devDependencies: { eslint: '^8.57.0' } },
            null,
            2,
        ),
    });
    const rows = await listRows(sandbox.path);
    expect(rows.filter(({ source }) => source === 'dependency').map(({ line }) => line)).toStrictEqual([6]);
});

test('lint commands: a root devDependency that gspot pins names both versions', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ devDependencies: { eslint: '^8.57.0', vitest: '^3.0.0' } }, null, 2),
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ line, command }) => [line, command])).toStrictEqual([
        [3, 'eslint ^8.57.0, and gspot pins 10.13.0'],
    ]);
});

test('lint commands: the settings of a covered tool count', async () => {
    await using sandbox = await createGitSandbox({
        'pyproject.toml': '[project]\nname = "app"\n\n[tool.black]\nline-length = 100\n',
        'setup.cfg': '[flake8]\nmax-line-length = 100\n',
        'mypy.ini': '[mypy]\nstrict = true\n',
        '.isort.cfg': '[settings]\nprofile = black\n',
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ file, line, command, tool }) => [file, line, command, tool])).toStrictEqual([
        ['pyproject.toml', 4, '[tool.black]', 'black'],
        ['setup.cfg', 1, '[flake8]', 'flake8'],
        ['.isort.cfg', 1, '.isort.cfg', 'isort'],
        ['mypy.ini', 1, 'mypy.ini', 'mypy'],
    ]);
});

test('lint commands: a gspot command, and the files of gspot, do not count', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ scripts: { lint: 'gspot check --only javascript/eslint' } }),
        '.gspot/package.json': JSON.stringify({ scripts: { lint: 'eslint .' } }),
    });
    expect(await listRows(sandbox.path)).toStrictEqual([]);
});

test('lint commands read the jobs after a GitLab component specification and keep reference tags quiet', async () => {
    await using sandbox = await createGitSandbox({
        '.gitlab/ci/quality.yml':
            'spec:\n  inputs:\n    stage:\n      default: test\n---\n.base:\n  script: echo ready\nquality:\n  script:\n    - !reference [.base, script]\n    - eslint src\n',
    });
    const warnings: string[] = [];
    using _warnings = spyOn(process, 'emitWarning').mockImplementation((warning) => {
        warnings.push(String(warning));
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ command }) => command)).toStrictEqual(['eslint src']);
    expect(warnings).toStrictEqual([]);
});

test('lint commands skip a CI file and a package.json that do not parse', async () => {
    await using sandbox = await createGitSandbox({
        '.gitlab-ci.yml': 'quality: [unterminated',
        'tests/fixtures/broken/package.json': '{ nope',
    });
    expect(await listRows(sandbox.path)).toStrictEqual([]);
});

test('lint commands read the strings of a package.json and leave its other values', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({
            scripts: { lint: 'eslint .', build: 1 },
            devDependencies: 'none',
            'lint-staged': { '*.js': { command: 'eslint' } },
            'simple-git-hooks': { 'pre-commit': 'npx eslint .', preserveUnused: ['commit-msg'] },
        }),
    });
    const rows = await listRows(sandbox.path);
    expect(rows.map(({ source, command }) => [source, command])).toStrictEqual([
        ['script', 'eslint .'],
        ['hook', 'npx eslint .'],
    ]);
});
