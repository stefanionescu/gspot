import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { ParameterFinding } from '#tests/types/tool-output.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { runCommand, runCommandBlocking } from '#tests/setup/processes.ts';
import { PARAMETER_LIMIT_TOOLS } from '#tests/data/checks/structure/parameters.ts';
import { RUFF_SUPPRESSIONS, VALE_SUPPRESSIONS } from '#tests/data/checks/gspot/suppressions.ts';

/** For each path: whether the tool suppressed it, and the directive findings that gspot reports. */
async function readSuppressionResults(root: string, paths: string[], reported: Set<string>) {
    const checked = parseCheckReport(await spawnGspot(root, ['check', '--only', 'gspot/suppressions', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.report.checks.flatMap((check) => check.findings);
    return paths.map((path) => ({
        path,
        suppressed: !reported.has(path),
        directives: findings.filter((finding) => finding.file === path).map(({ line, rule }) => ({ line, rule })),
    }));
}

test('suppression detection agrees with Ruff on every noqa comment form and place', async () => {
    await using sandbox = await testdir();
    const paths = RUFF_SUPPRESSIONS.map((_, index) => `source_${String(index)}.py`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_SUPPRESSIONS.map(({ source }, index) => [paths[index]!, source])),
    });
    await installToolProjects(sandbox.path);
    const ruff = buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff');
    const toolResult = await runCommand(
        [ruff, 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path, env: {} },
    );
    expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(1);
    const reported = new Set(
        (JSON.parse(toolResult.stdout) as Record<'filename', string>[]).map(({ filename }) => basename(filename)),
    );
    expect(await readSuppressionResults(sandbox.path, paths, reported)).toStrictEqual(
        RUFF_SUPPRESSIONS.map(({ source, suppressed, directive }, index) => ({
            path: paths[index]!,
            suppressed,
            directives: directive && !source.includes('# reason:') ? [{ line: 1, rule: 'ruff-no-reason' }] : [],
        })),
    );
});

test('suppression detection finds Vale comments and skips documented examples', async () => {
    await using sandbox = await testdir();
    const documents = VALE_SUPPRESSIONS.flatMap((entry, index) =>
        ['md', 'mdx'].map((extension) => ({ ...entry, path: `guide-${String(index)}.${extension}` })),
    );
    const paths = documents.map(({ path }) => path);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['prose']),
        '.vale.ini': `StylesPath = styles
[formats]
mdx = md
[*]
BasedOnStyles = Example
`,
        'styles/Example/Concrete.yml': `extends: existence
message: "Use inspect."
level: error
tokens: [delve]
`,
        ...Object.fromEntries(
            documents.map(({ source, path }) => [
                path,
                `# Guide

${source}

We delve into records.
`,
            ]),
        ),
    });
    const toolResult = await runCommand(['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', ...paths], {
        cwd: sandbox.path,
        env: {},
    });
    expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(0);
    const reported = new Set(
        Object.entries(JSON.parse(toolResult.stdout) as Record<string, unknown[]>)
            .filter(([, alerts]) => alerts.length > 0)
            .map(([file]) => basename(file)),
    );
    expect(await readSuppressionResults(sandbox.path, paths, reported)).toStrictEqual(
        documents.map(({ suppressed, directive, path }) => ({
            path,
            suppressed,
            directives: directive ? [{ line: 3, rule: 'vale' }] : [],
        })),
    );
});

test.each(['default', 8] as const)('Ruff counts declared parameters with maximum %s', async (supplied) => {
    const scenario = PARAMETER_LIMIT_TOOLS[0];
    await using sandbox = await testdir();
    const { maximum, defaultMaximum } = await prepareParameterProject(sandbox.path, scenario, supplied);
    await installToolProjects(sandbox.path);
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
