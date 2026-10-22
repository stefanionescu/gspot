import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { ParameterFinding } from '#tests/types/tool-output.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { spawnGspot, installGeneratedTools } from '#tests/setup/cli/commands.ts';
import { PARAMETER_LIMIT_TOOLS } from '#tests/config/integration/checks/general/structure.ts';

test.each(['default', 8] as const)('Ruff counts declared parameters with maximum %s', async (supplied) => {
    const scenario = PARAMETER_LIMIT_TOOLS[0];
    await using sandbox = await testdir();
    const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
    await installGeneratedTools(sandbox.path);
    const result = runCommandBlocking(
        [buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff'), ...scenario.command.slice(1)],
        { cwd: sandbox.path },
    );
    const findings = JSON.parse(result.stdout) as ParameterFinding[];
    expect(result.code, result.stdout + result.stderr).toBe(maximum === defaultMaximum ? scenario.failureStatus : 0);
    expect(findings.filter((finding) => finding.code === 'PLR0913')).toMatchObject(
        maximum === defaultMaximum ? [scenario.finding] : [],
    );
});

test.skipIf(!hasToolBuild('swiftlint')).each(['default', 8] as const)(
    'SwiftLint counts declared parameters with maximum %s',
    async (supplied) => {
        const scenario = PARAMETER_LIMIT_TOOLS[1];
        await using sandbox = await testdir();
        const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
        const result = runCommandBlocking(scenario.command, { cwd: sandbox.path });
        const findings = JSON.parse(result.stdout) as ParameterFinding[];
        expect(result.code, result.stdout + result.stderr).toBe(
            maximum === defaultMaximum ? scenario.failureStatus : 0,
        );
        expect(findings.filter((finding) => finding.rule_id === 'function_parameter_count')).toMatchObject(
            maximum === defaultMaximum ? [scenario.finding] : [],
        );
    },
);

/** Write the parameter-limit setting and source before invoking each native tool. */
async function prepareParameterProject(
    root: string,
    scenario: (typeof PARAMETER_LIMIT_TOOLS)[number],
    supplied: 'default' | number,
) {
    const { value: defaultMaximum } = buildKnownSettings([readConfigurations().get('structure')!], 'all').defaults.get(
        'limits.function_parameters',
    )!;
    const maximum = supplied === 'default' ? defaultMaximum : supplied;
    const limits =
        maximum === defaultMaximum
            ? ''
            : `[limits.${scenario.language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.language], { tables: limits, level: 'all' }),
        [scenario.file]: scenario.source,
    });
    expect(await spawnGspot(root, ['apply'])).toMatchObject({ code: 0 });
    return { maximum, defaultMaximum };
}
