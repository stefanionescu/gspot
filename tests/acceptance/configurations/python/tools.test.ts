// Planted repository for the python configuration: a lint finding, a layout finding, a type error, a stale docstring, a requirements file.
import type { RunReport } from '#cli/types/reports.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'python',
    '--without',
    'naming',
    'spelling',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PROJECT = '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n';
const CLEAN =
    '"""Arithmetic the planted tests call."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value (int): The number.\n\n    Returns:\n        int: Twice the number.\n\n    """\n    return value * 2\n';
const MODULE = 'planted/math.py';

const CASES: PlantedCase[] = [
    {
        check: 'python/ruff',
        files: {
            [MODULE]: `${CLEAN}\n\ndef run(code: str) -> object:\n    """Run code.\n\n    Args:\n        code (str): The code.\n\n    Returns:\n        object: What it gave.\n\n    """\n    return eval(code)\n`,
        },
        expected: 'S307',
    },
    {
        check: 'python/ruff-format',
        files: { [MODULE]: CLEAN.replace('return value * 2', () => 'return value*2') },
        expected: 'not formatted the way Ruff formats it',
    },
    {
        check: 'python/basedpyright',
        files: { [MODULE]: CLEAN.replace('return value * 2', () => 'return str(value)') },
        expected: 'reportReturnType',
    },
    {
        check: 'python/pydoclint',
        files: {
            [MODULE]: CLEAN.replace('        value (int): The number.\n', () => '        amount (int): The number.\n'),
        },
        expected: 'DOC',
    },
    {
        check: 'python/vulture',
        files: { 'planted/unused.py': '"""A module that imports what it never uses."""\n\nimport colorsys\n' },
        expected: "unused import 'colorsys'",
    },
    {
        check: 'python/pyproject',
        files: { 'pyproject.toml': PROJECT.replace('version = "1.0.0"', () => 'version = 7') },
        expected: 'pyproject.toml',
    },
    {
        check: 'integrity/dependency-ownership',
        files: { 'requirements.txt': 'requests==2.32.0\n', 'uv.lock': 'version = 1\n' },
        expected: 'a second owner of the dependencies',
    },
    {
        check: 'integrity/dependency-ownership',
        files: { 'scripts/setup.sh': '#!/usr/bin/env bash\npip install requests\n', 'uv.lock': 'version = 1\n' },
        expected: 'installs versions nobody reviewed',
    },
    {
        check: 'integrity/typecheck-membership',
        files: {},
        policy: '[[tools.basedpyright.exclude]]\npaths = ["planted/gone.py"]\nreason = "A file that needed another dependency set."\n',
        expected: 'matches no tracked file',
    },
];

describe('the python configuration', () => {
    test(
        'every python check fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': PROJECT,
                'planted/__init__.py': '"""The planted package."""\n',
                [MODULE]: CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const checkIds = new Set([
                ...CASES.map((planted) => planted.check),
                'python/import-linter',
                'python/deptry',
            ]);
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout + outcome.stderr, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'init preserves unsupported Pyright settings and carries exclusions after correction',
        async () => {
            const typed = `${CLEAN}\n\nTOTAL: int = "three"\n`;
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': PROJECT,
                'pyrightconfig.json':
                    '{\n    "typeCheckingMode": "basic",\n    "exclude": [".venv", "planted/skipped.py"]\n}\n',
                'planted/__init__.py': '"""The planted package."""\n',
                'planted/skipped.py': '"""A file the old setup left out."""\n',
                [MODULE]: typed,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            const refusedInit = await run(sandbox.path, INIT, environment);
            expect(refusedInit.code, refusedInit.stdout + refusedInit.stderr).toBe(2);
            expect(refusedInit.stdout + refusedInit.stderr).toContain('typeCheckingMode');
            expect(await Bun.file(`${sandbox.path}/pyrightconfig.json`).text()).toContain('"basic"');
            expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
            await Bun.write(`${sandbox.path}/pyrightconfig.json`, '{"exclude":[".venv","planted/skipped.py"]}\n');
            await install(sandbox.path, [...INIT, '--allow-dirty'], environment);
            const stub = await Bun.file(`${sandbox.path}/pyrightconfig.json`).text();
            expect(stub).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
            expect(stub).not.toContain('basic');
            const policy = await Bun.file(`${sandbox.path}/gspot.toml`).text();
            expect(policy).toContain('planted/skipped.py');
            expect(policy).toContain('.venv');
            expect(await Bun.file(`${sandbox.path}/.gspot/baselines/basedpyright.root.json`).exists()).toBe(false);
            const command = ['check', '--only', 'python/basedpyright', '--no-cache', '--json'];
            const refused = await run(sandbox.path, command, environment);
            expect(refused.code, refused.stdout + refused.stderr).toBe(1);
            const report = JSON.parse(refused.stdout) as RunReport;
            expect(report.checks.map((check) => [check.check, check.status])).toEqual([
                ['python/basedpyright', 'fail'],
            ]);
            expect(report.checks[0]?.findings).toContainEqual(
                expect.objectContaining({
                    file: MODULE,
                    rule: 'reportAssignmentType',
                }),
            );
            await Bun.write(`${sandbox.path}/${MODULE}`, `${CLEAN}\n\nTOTAL: int = 3\n`);
            const corrected = await run(sandbox.path, command, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = JSON.parse(corrected.stdout) as RunReport;
            expect(accepted.checks.map((check) => [check.check, check.status])).toEqual([
                ['python/basedpyright', 'ok'],
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
