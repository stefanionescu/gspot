import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
// Planted repository for the python configuration: a lint finding, a layout finding, a type error, a stale docstring, a requirements file.
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { install, installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';

import {
    STRUCTURE_INIT,
    TOOLS_CLEAN,
    TOOLS_MODULE,
    TOOLS_PROJECT,
} from '#tests/constants/acceptance/source/configurations/python.ts';

const CASES: FindingCase[] = [
    {
        check: 'python/ruff',
        files: {
            [TOOLS_MODULE]: `${TOOLS_CLEAN}\n\ndef run(code: str) -> object:\n    """Run code.\n\n    Args:\n        code (str): The code.\n\n    Returns:\n        object: What it gave.\n\n    """\n    return eval(code)\n`,
        },
        expected: { file: TOOLS_MODULE, rule: 'S307', line: 27 },
    },
    {
        check: 'python/ruff-format',
        files: { [TOOLS_MODULE]: TOOLS_CLEAN.replace('return value * 2', () => 'return value*2') },
        expected: { file: TOOLS_MODULE },
    },
    {
        check: 'python/basedpyright',
        files: { [TOOLS_MODULE]: TOOLS_CLEAN.replace('return value * 2', () => 'return str(value)') },
        expected: { file: TOOLS_MODULE, rule: 'reportReturnType', line: 14 },
    },
    {
        check: 'python/pydoclint',
        files: {
            [TOOLS_MODULE]: TOOLS_CLEAN.replace(
                '        value (int): The number.\n',
                () => '        amount (int): The number.\n',
            ),
        },
        expected: { file: TOOLS_MODULE, rule: 'DOC103', line: 4 },
    },
    {
        check: 'python/vulture',
        files: { 'planted/unused.py': '"""A module that imports what it never uses."""\n\nimport colorsys\n' },
        expected: { file: 'planted/unused.py', line: 3 },
    },
    {
        check: 'python/pyproject',
        files: { 'pyproject.toml': TOOLS_PROJECT.replace('version = "1.0.0"', () => 'version = 7') },
        expected: { file: 'pyproject.toml' },
    },
    {
        check: 'integrity/dependency-ownership',
        files: { 'requirements.txt': 'requests==2.32.0\n', 'uv.lock': 'version = 1\n' },
        expected: { file: 'requirements.txt', rule: 'requirements-file', line: 1 },
    },
    {
        check: 'integrity/dependency-ownership',
        files: { 'scripts/setup.sh': '#!/usr/bin/env bash\npip install requests\n', 'uv.lock': 'version = 1\n' },
        expected: { file: 'scripts/setup.sh', rule: 'pip-install', line: 2 },
    },
    {
        check: 'integrity/typecheck-membership',
        files: {},
        policy: '[[tools.basedpyright.exclude]]\npaths = ["planted/gone.py"]\nreason = "A file that needed another dependency set."\n',
        expected: { file: 'gspot.toml', rule: 'stale-exclusion', line: 1 },
    },
];

describe('the python configuration', () => {
    test.each(CASES)(
        '$check reports its defect in $expected.file and accepts a correction',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': TOOLS_PROJECT,
                'planted/__init__.py': '"""The planted package."""\n',
                [TOOLS_MODULE]: TOOLS_CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, STRUCTURE_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            const files: Record<string, string> = { [TOOLS_MODULE]: TOOLS_CLEAN };
            if (planted.check === 'python/vulture') files['planted/unused.py'] = '"""No unused imports."""\n';
            if (planted.check === 'integrity/dependency-ownership') {
                files['uv.lock'] = 'version = 1\n';
                files['scripts/setup.sh'] =
                    '#!/usr/bin/env bash\nprintf "Dependencies are owned by pyproject.toml\\n"\n';
            }
            if (planted.check === 'integrity/typecheck-membership')
                files['planted/gone.py'] = '"""A file with a separate dependency set."""\n';
            const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'init preserves unsupported Pyright settings and carries exclusions after correction',
        async () => {
            const typed = `${TOOLS_CLEAN}\n\nTOTAL: int = "three"\n`;
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': TOOLS_PROJECT,
                'pyrightconfig.json':
                    '{\n    "typeCheckingMode": "basic",\n    "exclude": [".venv", "planted/skipped.py"]\n}\n',
                'planted/__init__.py': '"""The planted package."""\n',
                'planted/skipped.py': '"""A file the old setup left out."""\n',
                [TOOLS_MODULE]: typed,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            const refusedInit = await run(sandbox.path, STRUCTURE_INIT, environment);
            expect(refusedInit.code, refusedInit.stdout + refusedInit.stderr).toBe(2);
            expect(refusedInit.stdout + refusedInit.stderr).toContain('typeCheckingMode');
            expect(await Bun.file(`${sandbox.path}/pyrightconfig.json`).text()).toContain('"basic"');
            expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
            await Bun.write(`${sandbox.path}/pyrightconfig.json`, '{"exclude":[".venv","planted/skipped.py"]}\n');
            await install(sandbox.path, [...STRUCTURE_INIT, '--allow-dirty'], environment);
            const pointer = await Bun.file(`${sandbox.path}/pyrightconfig.json`).text();
            expect(pointer).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
            expect(pointer).not.toContain('basic');
            const policy = await Bun.file(`${sandbox.path}/gspot.toml`).text();
            expect(policy).toContain('planted/skipped.py');
            expect(policy).toContain('.venv');
            const command = ['check', '--only', 'python/basedpyright', '--no-cache', '--json'];
            const refused = await run(sandbox.path, command, environment);
            expect(refused.code, refused.stdout + refused.stderr).toBe(1);
            const report = JSON.parse(refused.stdout) as RunReport;
            expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
                ['python/basedpyright', 'fail'],
            ]);
            expect(report.checks[0]?.findings).toContainEqual(
                containing({
                    file: TOOLS_MODULE,
                    rule: 'reportAssignmentType',
                }),
            );
            await Bun.write(`${sandbox.path}/${TOOLS_MODULE}`, `${TOOLS_CLEAN}\n\nTOTAL: int = 3\n`);
            const corrected = await run(sandbox.path, command, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = JSON.parse(corrected.stdout) as RunReport;
            expect(accepted.checks.map((check) => [check.check, check.status])).toStrictEqual([
                ['python/basedpyright', 'ok'],
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
