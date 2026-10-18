import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import type { ParameterFinding } from '#tests/types/tool-output.ts';
import { runCommand, runCommandBlocking } from '#tests/setup/processes.ts';
import { buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';
import { PARAMETER_LIMIT_TOOLS } from '#tests/data/checks/structure/parameters.ts';
import { RUFF_SUPPRESSIONS, VALE_SUPPRESSIONS } from '#tests/data/checks/gspot/suppressions.ts';

/** For each path: whether the tool suppressed it, and the directive findings that gspot reports. */
async function readSuppressionResults(root: string, paths: string[], reported: Set<string>) {
    const checked = await spawnGspot(root, ['check', '--only', 'gspot/suppressions', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
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
        'gspot.toml': buildSettingsText(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_SUPPRESSIONS.map(({ source }, index) => [paths[index]!, source])),
    });
    await installToolProjects(sandbox.path);
    const ruff = buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff');
    const toolResult = await runCommand(
        [ruff, 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path, env: { PATH: buildSandboxPath() } },
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
        'gspot.toml': buildSettingsText(['prose']),
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
        env: { PATH: buildSandboxPath() },
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

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of PARAMETER_LIMIT_TOOLS.filter(
    (entry) => entry.language !== 'swift' || hasToolBuild('swiftlint'),
)) {
    test.each(['default', 8] as const)(
        `${scenario.command[0]} counts declared parameters with maximum %i`,
        async (supplied) => {
            const { value: defaultMaximum } = buildKnownSettings(
                [readManifests(createReadCache(process.cwd())).get('structure')!],
                'all',
                createReadCache(process.cwd()),
            ).defaults.get('limits.function_parameters')!;
            const maximum = supplied === 'default' ? defaultMaximum : supplied;
            await using sandbox = await testdir();
            const { language } = scenario;
            const limits =
                maximum === defaultMaximum
                    ? ''
                    : `[limits.${language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
            await createFileTree(sandbox.path, {
                'gspot.toml': buildSettingsText([language], { tables: limits, level: 'all' }),
                [scenario.file]: scenario.source,
            });
            expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
            if (language === 'python') await installToolProjects(sandbox.path);
            const command =
                language === 'python'
                    ? [
                          buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff'),
                          ...scenario.command.slice(1),
                      ]
                    : scenario.command;
            const result = runCommandBlocking(command, {
                cwd: sandbox.path,
            });
            const findings = JSON.parse(result.stdout) as ParameterFinding[];
            expect(result.code, result.stdout + result.stderr).toBe(
                maximum === defaultMaximum ? scenario.failureStatus : 0,
            );
            expect(
                findings.filter(
                    (finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count',
                ),
            ).toMatchObject(maximum === defaultMaximum ? [scenario.finding] : []);
        },
    );
}
