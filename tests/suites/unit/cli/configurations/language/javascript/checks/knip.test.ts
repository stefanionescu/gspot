import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeNpmTool } from '#tests/setup/cli/tools.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('javascript/knip keeps only the findings of the files that Git lists', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': 'ignored/\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'export const value = 1;\n',
        'ignored/copy.js': 'export const value = 1;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    await fakeNpmTool(sandbox.path, 'knip');
    const exports = [{ name: 'value', line: 1, col: 14 }];
    const stdout = JSON.stringify({
        issues: [
            { file: 'source.js', exports },
            { file: 'ignored/copy.js', exports },
        ],
    });
    using _boundary = fakeCommands().mockResolvedValue(buildProcessResult({ code: 1, stdout }));
    const findings = await runSandboxCheck(sandbox.path, 'javascript/knip');
    expect(findings.map(({ file }) => file)).toStrictEqual(['source.js']);
});
