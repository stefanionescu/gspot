import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildPythonToolFiles } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { executableLayout } from '#cli/system/processes/programs.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { level: 'basic', shipped: ['basic.yml'] },
    { level: 'all', shipped: ['basic.yml', 'all.yml'] },
] as const)(
    'security/semgrep passes the rule files of its level and each semgrep_rules path once at level $level',
    async ({ level, shipped }) => {
        const folder = '.gspot/configurations/machine-learning/semgrep';
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['security', 'machine-learning'], {
                level,
                tables: `[security]\nsemgrep_rules = ["rules/local.yml", "${folder}/basic.yml"]\n`,
            }),
            'rules/local.yml': 'rules: []\n',
            [`${folder}/basic.yml`]: 'rules: []\n',
            'model.py': 'value = 1\n',
            [join(join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder), 'semgrep')]: 'stub',
            ...buildPythonToolFiles('semgrep'),
        });
        await applyGeneratedFiles(sandbox.path);
        using spawn = fakeCommands().mockResolvedValue(buildProcessResult({ stdout: '{"results":[],"errors":[]}' }));
        await runSandboxCheck(sandbox.path, 'security/semgrep');
        const command = spawn.mock.calls.map(([each]) => each).find((each) => each.includes('scan')) ?? [];
        expect(command.filter((_, index) => command[index - 1] === '--config')).toStrictEqual(
            [...shipped.map((name) => `${folder}/${name}`), 'rules/local.yml'].map((path) => join(sandbox.path, path)),
        );
    },
);
