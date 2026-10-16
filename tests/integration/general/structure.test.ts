import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { knownSettings } from '#cli/settings/view.ts';
import { openSession } from '#cli/commands/session.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { virtualEnvironmentExecutable } from '#cli/system/paths.ts';
import type { ParameterFinding } from '#tests/types/tool-output.ts';
import { toolsPath, installToolProjects } from '#tests/setup/install.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { runCommand, runCommandBlocking } from '#tests/setup/processes.ts';
import { PARAMETER_LIMIT_TOOLS } from '#tests/config/structure/parameters.ts';
import { RUFF_SUPPRESSIONS, VALE_SUPPRESSIONS } from '#tests/config/suppressions.ts';

test('suppression detection agrees with Ruff on every noqa comment form and place', async () => {
    await using sandbox = await testdir();
    const paths = RUFF_SUPPRESSIONS.map((_, index) => `source_${String(index)}.py`);
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_SUPPRESSIONS.map(({ source }, index) => [paths[index]!, source])),
    });
    await installToolProjects(sandbox.path);
    const ruff = virtualEnvironmentExecutable(join(sandbox.path, '.gspot/.venv'), 'ruff');
    const native = await runCommand(
        [ruff, 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path, env: { PATH: toolsPath() } },
    );
    expect(native.code, native.stdout + native.stderr).toBe(1);
    const reported = new Set(
        (JSON.parse(native.stdout) as Record<'filename', string>[]).map(({ filename }) => basename(filename)),
    );
    const checked = await spawnGspot(sandbox.path, ['check', '--only', 'gspot/suppressions', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: findings.filter((finding) => finding.file === path).map(({ line, rule }) => ({ line, rule })),
        })),
    ).toStrictEqual(
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
        'gspot.toml': settingsText(['prose']),
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
    const native = await runCommand(['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', ...paths], {
        cwd: sandbox.path,
        env: { PATH: toolsPath() },
    });
    expect(native.code, native.stdout + native.stderr).toBe(0);
    const reported = new Set(
        Object.entries(JSON.parse(native.stdout) as Record<string, unknown[]>)
            .filter(([, alerts]) => alerts.length > 0)
            .map(([file]) => basename(file)),
    );
    const checked = await spawnGspot(sandbox.path, ['check', '--only', 'gspot/suppressions', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: findings.filter((finding) => finding.file === path).map(({ line, rule }) => ({ line, rule })),
        })),
    ).toStrictEqual(
        documents.map(({ suppressed, directive, path }) => ({
            path,
            suppressed,
            directives: directive ? [{ line: 3, rule: 'vale' }] : [],
        })),
    );
});

const { value: defaultMaximum } = knownSettings([configurationManifests().get('structure')!], 'all').defaults.get(
    'limits.function_parameters',
)!;

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of PARAMETER_LIMIT_TOOLS.filter(
    (entry) => entry.language !== 'swift' || hasToolBuild('swiftlint'),
)) {
    test.each([defaultMaximum, 8])(
        `${scenario.command[0]} counts declared parameters with maximum %i`,
        async (maximum) => {
            await using directory = await testdir();
            const { language } = scenario;
            const limits =
                maximum === defaultMaximum
                    ? ''
                    : `[limits.${language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
            await createFileTree(directory.path, {
                'gspot.toml': settingsText([language], { tables: limits, level: 'all' }),
                [scenario.file]: scenario.source,
            });
            const session = await openSession(directory.path);
            {
                using log = openWriter(directory.path);
                writeGeneratedFiles(session, emitAll(session), log);
            }
            if (language === 'python') await installToolProjects(directory.path);
            const command =
                language === 'python'
                    ? [
                          virtualEnvironmentExecutable(join(directory.path, '.gspot/.venv'), 'ruff'),
                          ...scenario.command.slice(1),
                      ]
                    : scenario.command;
            const result = runCommandBlocking(command, {
                cwd: directory.path,
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
