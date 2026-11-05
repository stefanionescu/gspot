import { basename } from 'node:path';

import { expect, test } from 'bun:test';

import { VALE_SUPPRESSION_SETTINGS, VALE_SUPPRESSIONS } from '#tests/config/integration/general.ts';
import { readSuppressionResults } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

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
