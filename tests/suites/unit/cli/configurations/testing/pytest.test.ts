import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import { COVERAGE_PROJECT_FILES } from '#tests/config/configurations/python.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const COVERAGE_FLAG = '--cov-config=';

async function runPytest(root: string): Promise<{ result: CheckResult; commands: string[][] }> {
    await applyGeneratedFiles(root);
    const session = await openSession(root);
    const planned = planChecks(session, { only: ['pytest/tests'], stage: 'push' })[0]!;
    planned.tool = { name: process.execPath, kind: 'program', installers: {} };
    planned.check = { ...planned.check, tool: process.execPath, secondary_tools: [] };
    const commands: string[][] = [];
    using _spawn = fakeCommands(process.execPath, (command) => {
        commands.push([...command]);
        return Promise.resolve(buildProcessResult());
    });
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        selectCheckCode(planned.check),
        {},
    );
    return { result, commands };
}

function findCoverageFile(commands: string[][]): string | undefined {
    return commands[0]?.find((argument) => argument.startsWith(COVERAGE_FLAG))?.slice(COVERAGE_FLAG.length);
}

test.each(COVERAGE_PROJECT_FILES)(
    'pytest respects $name and only adds its generated omissions as a fallback',
    async ({ files, generated }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['pytest', 'python'], {
                level: 'all',
                tables: 'test_files = ["tests/test_*.py"]\n',
            }),
            'tests/test_example.py': 'def test_example():\n    assert True\n',
            '.venv/.keep': '',
            ...files,
        });
        const { result, commands } = await runPytest(sandbox.path);
        expect(result.status, result.note).toBe('passed');
        expect(commands).toHaveLength(1);
        expect(findCoverageFile(commands) !== undefined).toBe(generated);
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    },
);

test('the pytest coverage file omits only Python test patterns', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['pytest', 'python'], {
            level: 'all',
            tables: 'test_files = ["tests/test_*.py", "**/*.test.*"]\n',
        }),
        'tests/test_example.py': 'def test_example():\n    assert True\n',
        '.venv/.keep': '',
    });
    const { commands } = await runPytest(sandbox.path);
    const text = await readFile(resolve(sandbox.path, findCoverageFile(commands) ?? ''), 'utf8');
    expect(text.split('\n').slice(text.split('\n').indexOf('omit =') + 1)).toStrictEqual(['    tests/test_*.py', '']);
});
