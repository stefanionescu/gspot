import { expect, test } from 'bun:test';

import { BROKEN_TOOL_ADVICE } from '#cli/config/engine.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { addCommandLine } from '#cli/engine/tool-runs/output.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import type { CommandRun } from '#cli/types/engine/tool-runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('an unexplained failed invocation fails the run with one finding', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['format/prettier'] })[0]!;
    const tool = getTool(readConfigurations().values(), 'prettier');
    const state: CommandRun = { root: sandbox.path, cwd: sandbox.path, findings: [], failed: false };
    addCommandLine(
        planned,
        tool,
        {
            commandLine: { commandArguments: ['prettier'] },
            result: buildProcessResult({ code: 1, stdout: 'Format failed\n' }),
            findings: [],
        },
        state,
    );
    expect(state.failed).toBe(true);
    expect(state.findings).toMatchObject([{ file: '', message: 'Format failed', fixable: false }]);
});

test('an unexplained failure of a tool that fails to load ends with gspot install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.js': 'export const ready = true;\n',
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'commit', only: ['format/prettier'] })[0]!;
    const state: CommandRun = { root: sandbox.path, cwd: sandbox.path, findings: [], failed: false };
    const stderr = `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '${sandbox.path}/.gspot/node_modules/prettier/index.mjs'\n`;
    addCommandLine(
        planned,
        getTool(readConfigurations().values(), 'prettier'),
        {
            commandLine: { commandArguments: ['prettier'] },
            result: buildProcessResult({ code: 1, stderr }),
            findings: [],
        },
        state,
    );
    expect(state.findings.map(({ message }) => message)).toStrictEqual([`${stderr.trim()}\n${BROKEN_TOOL_ADVICE}`]);
});
