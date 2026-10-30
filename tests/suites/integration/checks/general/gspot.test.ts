import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    VALE_SUPPRESSIONS,
    RUFF_SUPPRESSIONS,
    VALE_SUPPRESSION_SETTINGS,
} from '#tests/config/integration/checks/general/general.ts';

test('suppression detection agrees with Ruff on every noqa comment form and place', async () => {
    const paths = RUFF_SUPPRESSIONS.map((_, index) => `source_${String(index)}.py`);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_SUPPRESSIONS.map(({ source }, index) => [paths[index]!, source])),
    });
    await applyThenInstall(sandbox.path);
    const ruff = buildVenvExecutablePath(join(sandbox.path, GSPOT_PATHS.pythonEnvironment), 'ruff');
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

test('suppression detection finds Vale comments and skips documented examples', async () => {
    const documents = VALE_SUPPRESSIONS.flatMap((suppression, index) =>
        ['md', 'mdx'].map((extension) => ({ ...suppression, path: `guide-${String(index)}.${extension}` })),
    );
    const paths = documents.map(({ path }) => path);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose']),
        '.vale.ini': VALE_SUPPRESSION_SETTINGS,
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
