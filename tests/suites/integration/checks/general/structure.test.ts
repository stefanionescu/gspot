import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import type { LinterJsonFinding } from '#tests/types/tools.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { spawnGspot, applyThenInstall } from '#tests/setup/cli/commands.ts';
import { PARAMETER_LIMIT_TOOLS } from '#tests/config/integration/checks/general/structure.ts';

test.each(['default', 8] as const)('Ruff counts parameters with maximum %s', async (supplied) => {
    const scenario = PARAMETER_LIMIT_TOOLS[0];
    await using sandbox = await createGitSandbox({});
    const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
    await applyThenInstall(sandbox.path);
    const result = runCommandBlocking(
        [
            buildVenvExecutablePath(join(sandbox.path, GSPOT_PATHS.pythonEnvironment), 'ruff'),
            'check',
            '--config',
            findManifestTarget('python', 'ruff.toml'),
            '--output-format',
            'json',
            scenario.file,
        ],
        { cwd: sandbox.path },
    );
    const findings = JSON.parse(result.stdout) as LinterJsonFinding[];
    expect(result.code, result.stdout + result.stderr).toBe(maximum === defaultMaximum ? scenario.failureStatus : 0);
    expect(findings.filter((finding) => finding.code === 'PLR0913')).toMatchObject(
        maximum === defaultMaximum ? [scenario.finding] : [],
    );
});

test.skipIf(!hasToolBuild('swiftlint')).each(['default', 8] as const)(
    'SwiftLint counts parameters with maximum %s',
    async (supplied) => {
        const scenario = PARAMETER_LIMIT_TOOLS[1];
        await using sandbox = await createGitSandbox({});
        const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
        const result = runCommandBlocking(
            [
                'swiftlint',
                'lint',
                '--config',
                findManifestTarget('swift', 'swiftlint.yml'),
                '--reporter',
                'json',
                '--quiet',
                '--no-cache',
                scenario.file,
            ],
            { cwd: sandbox.path },
        );
        const findings = JSON.parse(result.stdout) as LinterJsonFinding[];
        expect(result.code, result.stdout + result.stderr).toBe(
            maximum === defaultMaximum ? scenario.failureStatus : 0,
        );
        expect(findings.filter((finding) => finding.rule_id === 'function_parameter_count')).toMatchObject(
            maximum === defaultMaximum ? [scenario.finding] : [],
        );
    },
);

async function prepareParameterProject(
    root: string,
    scenario: (typeof PARAMETER_LIMIT_TOOLS)[number],
    supplied: 'default' | number,
) {
    const { value: defaultMaximum } = buildAvailableSettings(
        [readConfigurations().get('structure')!],
        'all',
    ).defaults.get('limits.function_parameters')!;
    const maximum = supplied === 'default' ? defaultMaximum : supplied;
    const limits =
        maximum === defaultMaximum
            ? ''
            : `[limits.${scenario.language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.language], { tables: limits, level: 'all' }),
        [scenario.file]: scenario.source,
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    return { maximum, defaultMaximum };
}
