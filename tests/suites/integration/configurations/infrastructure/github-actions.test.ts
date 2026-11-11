import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GITHUB_WORKFLOW } from '#cli/config/generation.ts';
import { CALLER_WORKFLOW } from '#tests/config/setup/configurations.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const COMPOSITE_ACTION = `name: Greet
inputs:
    message:
        description: Message to print
        required: true
runs:
    using: composite
    steps:
        - shell: bash
          run: echo "\${{ inputs.message }}"
`;

const CHECKOUT_WORKFLOW = `on: workflow_dispatch
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          persist-credentials: false
`;

const REQUIRED_INPUT_WORKFLOW = `on:
  workflow_call:
    inputs:
      greeting:
        type: string
        required: true
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;

const TEMPLATE_INJECTION_WORKFLOW = `on: pull_request
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
`;

test('the generated GitHub workflow passes actionlint', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Workflow test\n' });

    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['github-actions'], { level: 'all', rules: true }),
    );
    await applyGeneratedFiles(sandbox.path);
    const ci = await spawnGspot(sandbox.path, ['set', 'ci.enabled', 'true']);
    expect(ci.code, ci.stdout + ci.stderr).toBe(0);
    const workflow = join(sandbox.path, GITHUB_WORKFLOW);
    const generated = await readFile(workflow);
    const headerEnd = generated.indexOf('\n');
    const body = generated.subarray(headerEnd + 1);
    await createFileTree(sandbox.path, { '.github/workflows/accepted.yml': body.toString('utf8') });
    const result = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/actionlint', '--json']),
    );
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.report.checks).toMatchObject([
        { check: 'github-actions/actionlint', status: 'passed', findings: [] },
    ]);
});

test('actionlint reports a missing required input of a same-repository reusable workflow and keeps the authored files', async () => {
    const workflow = CALLER_WORKFLOW;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        '.github/workflows/caller.yml': workflow,
        '.github/workflows/called.yml': REQUIRED_INPUT_WORKFLOW,
    });
    const failed = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/actionlint', '--json']),
    ).report.checks[0]!;
    expect(failed.status, JSON.stringify(failed)).toBe('failed');
    expect(failed.findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual([
        { file: '.github/workflows/caller.yml', line: 4, column: 11, rule: 'workflow-call' },
    ]);
    await writeFile(
        join(sandbox.path, '.github/workflows/caller.yml'),
        `${workflow}    with:\n      greeting: Hello\n`,
    );
    const result = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/actionlint', '--json']),
    ).report.checks[0]!;
    expect(result).toMatchObject({ status: 'passed', findings: [] });
});

test('zizmor at level basic checks workflows and composite actions in the root and a scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions'], {
            scopes: [{ path: 'app', configurations: ['github-actions'] }],
        }),
        '.github/workflows/source.yml': TEMPLATE_INJECTION_WORKFLOW,
        '.github/workflows/build.yml': CHECKOUT_WORKFLOW,
        '.github/actions/greet/action.yml': COMPOSITE_ACTION,
        'app/.github/workflows/build.yml': CHECKOUT_WORKFLOW,
        'app/.github/actions/greet/action.yaml': COMPOSITE_ACTION,
    });

    await applyGeneratedFiles(sandbox.path);
    const failed = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/zizmor', '--json']),
    ).report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: '.github/actions/greet/action.yml', rule: 'template-injection' },
        { file: '.github/workflows/source.yml', rule: 'template-injection' },
        { file: 'app/.github/actions/greet/action.yaml', rule: 'template-injection' },
    ]);
    await writeFile(join(sandbox.path, '.github/workflows/source.yml'), CHECKOUT_WORKFLOW);
    for (const path of ['.github/actions/greet/action.yml', 'app/.github/actions/greet/action.yaml'])
        await writeFile(
            join(sandbox.path, path),
            COMPOSITE_ACTION.replace(
                '          run: echo "${{ inputs.message }}"',
                '          env:\n              MESSAGE: ${{ inputs.message }}\n          run: echo "$MESSAGE"',
            ),
        );
    const corrected = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/zizmor', '--json']),
    ).report;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
});
