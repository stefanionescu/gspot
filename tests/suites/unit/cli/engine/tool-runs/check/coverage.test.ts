import { test, expect } from 'bun:test';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { COVERAGE_PROJECT_FILES } from '#tests/config/engine/tool-runs.ts';

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
        const planned = planChecks(session, { only: ['pytest/tests'], stage: 'push' })[0]!;
        planned.tool = { name: process.execPath, kind: 'program', installers: {} };
        planned.check = { ...planned.check, tool: process.execPath, other_tools: [] };
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
