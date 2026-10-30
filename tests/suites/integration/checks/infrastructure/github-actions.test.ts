import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import type { Explanation } from '#cli/types/commands/explain.ts';
import { CALLER_WORKFLOW } from '#tests/config/github-actions.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { GITHUB_WORKFLOW, GENERATED_HEADER_TEXT } from '#cli/config/generation/generation.ts';
import { spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    COMPOSITE_ACTION,
    CHECKOUT_WORKFLOW,
    REQUIRED_INPUT_WORKFLOW,
    TEMPLATE_INJECTION_WORKFLOW,
} from '#tests/config/integration/checks/infrastructure.ts';

test('workflow security checks report an untrusted expression in a run step', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        '.github/workflows/source.yml': TEMPLATE_INJECTION_WORKFLOW,
    });
    await applyThenInstall(sandbox.path);
    const result = parseCheckReport(
        await spawnGspot(sandbox.path, [
            'check',
            '--only',
            'github-actions/zizmor,github-actions/actionlint',
            '--json',
        ]),
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    for (const [check, expectedRule] of [
        ['github-actions/zizmor', 'template-injection'],
        ['github-actions/actionlint', 'expression'],
    ]) {
        const checked = result.report.checks.find(({ check: id }) => id === check);
        expect(checked?.status).toBe('failed');
        expect(checked?.findings.map(({ file, rule }) => ({ file, rule }))).toContainEqual({
            file: '.github/workflows/source.yml',
            rule: expectedRule,
        });
    }
});

test('the generated GitHub workflow passes actionlint', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Workflow test\n' });

    commitAll(sandbox.path);
    await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['github-actions'], install: false });
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const ci = await spawnGspot(sandbox.path, ['set', 'ci.enabled', 'true']);
    expect(ci.code, ci.stdout + ci.stderr).toBe(0);
    const workflow = join(sandbox.path, GITHUB_WORKFLOW);
    expect(await isOnDisk(workflow)).toBe(true);
    const generated = await readFile(workflow);
    const headerEnd = generated.indexOf('\n');
    expect(generated.subarray(0, headerEnd).toString('utf8')).toBe(`# ${GENERATED_HEADER_TEXT}`);
    const body = generated.subarray(headerEnd + 1);
    await createFileTree(sandbox.path, { '.github/workflows/accepted.yml': body.toString('utf8') });
    const explained = await spawnGspot(sandbox.path, ['explain', './.github/workflows/accepted.yml', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout) as Explanation['facts']).toMatchObject({
        kind: 'path',
        fileKind: 'source',
    });
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
    expect(await readFile(join(sandbox.path, '.github/workflows/caller.yml'), 'utf8')).toBe(workflow);
    await writeFile(
        join(sandbox.path, '.github/workflows/caller.yml'),
        `${workflow}    with:\n      greeting: Hello\n`,
    );
    const result = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/actionlint', '--json']),
    ).report.checks[0]!;
    expect(result).toMatchObject({ status: 'passed', findings: [] });
    expect(await readFile(join(sandbox.path, '.github/workflows/called.yml'), 'utf8')).toBe(REQUIRED_INPUT_WORKFLOW);
});

test('zizmor checks composite actions in the root and a scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['github-actions'] }],
        }),
        '.github/workflows/build.yml': CHECKOUT_WORKFLOW,
        '.github/actions/greet/action.yml': COMPOSITE_ACTION,
        'app/.github/workflows/build.yml': CHECKOUT_WORKFLOW,
        'app/.github/actions/greet/action.yaml': COMPOSITE_ACTION,
    });

    await applyThenInstall(sandbox.path);
    const failed = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'github-actions/zizmor', '--json']),
    ).report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: '.github/actions/greet/action.yml', rule: 'template-injection' },
        { file: 'app/.github/actions/greet/action.yaml', rule: 'template-injection' },
    ]);
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
