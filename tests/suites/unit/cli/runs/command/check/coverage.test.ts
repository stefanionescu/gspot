import { test, expect } from 'bun:test';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { planChecks } from '#cli/planning/checks.ts';
import { openSession } from '#cli/planning/session.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { buildCheckSession } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { COVERAGE_PROJECT_FILES } from '#tests/config/runs/command/coverage.ts';

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
        await applyGeneratedFiles(sandbox.path);
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { only: ['pytest/coverage'], stage: 'push' })[0]!;
        planned.tool = { name: process.execPath, kind: 'program', installers: {} };
        planned.check = { ...planned.check, tool: process.execPath, other_tools: [] };
        const commands: string[][] = [];
        using _spawn = fakeCommands(process.execPath, (command) => {
            commands.push([...command]);
            return Promise.resolve(buildProcessResult());
        });
        const result = await runCommandCheck(buildCheckSession(session), planned);
        expect(result.status, result.note).toBe('passed');
        expect(commands).toHaveLength(1);
        const coverage = commands[0]!.find((argument) => argument.startsWith('--cov-config='));
        expect(coverage !== undefined).toBe(generated);
        if (coverage !== undefined) {
            const text = await readFile(resolve(sandbox.path, coverage.slice('--cov-config='.length)), 'utf8');
            expect(text).toBe('[run]\nomit =\n    tests/test_*.py\n');
        }
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    },
);
