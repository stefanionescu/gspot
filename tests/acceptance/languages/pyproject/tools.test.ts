// Planted repository for the python preset: a lint finding, a layout finding, a type error, a stale docstring, a requirements file.
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'python',
    '--without',
    'naming',
    'structure',
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
    '"""Arithmetic the planted tests call."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value: The number.\n\n    Returns:\n        Twice the number.\n    """\n    return value * 2\n';
const MODULE = 'planted/math.py';

const CASES: PlantedCase[] = [
    {
        check: 'python/ruff',
        files: {
            [MODULE]: `${CLEAN}\n\ndef run(code: str) -> object:\n    """Run code.\n\n    Args:\n        code: The code.\n\n    Returns:\n        What it gave.\n    """\n    return eval(code)\n`,
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
        files: { [MODULE]: CLEAN.replace('        value: The number.\n', () => '        amount: The number.\n') },
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
        files: { 'requirements.txt': 'requests==2.32.0\n' },
        expected: 'a second owner of the dependencies',
    },
    {
        check: 'integrity/dependency-ownership',
        files: { 'scripts/setup.sh': '#!/usr/bin/env bash\npip install requests\n' },
        expected: 'installs versions nobody reviewed',
    },
    {
        check: 'integrity/typecheck-membership',
        files: {},
        policy: '[[tools.basedpyright.exclude]]\npaths = ["planted/gone.py"]\nreason = "A file that needed another dependency set."\n',
        expected: 'matches no tracked file',
    },
];

describe('the python preset', () => {
    test(
        'every python check fires on its planted defect',
        async () => {
            await using sandbox = await createSandbox({
                'pyproject.toml': PROJECT,
                'planted/__init__.py': '"""The planted package."""\n',
                [MODULE]: CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
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
        'a type error that init finds is held in a baseline of the scope, and the old excludes are carried',
        async () => {
            const typed = `${CLEAN}\n\nTOTAL: int = "three"\n`;
            await using sandbox = await createSandbox({
                'pyproject.toml': PROJECT,
                'pyrightconfig.json':
                    '{\n    "typeCheckingMode": "basic",\n    "exclude": [".venv", "planted/skipped.py"]\n}\n',
                'planted/__init__.py': '"""The planted package."""\n',
                'planted/skipped.py': '"""A file the old setup left out."""\n',
                [MODULE]: typed,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
            // The structure preset ships the check that reads a tool's own baseline file, so this install keeps it.
            const kept = INIT.map((part) => (part.startsWith('naming,') ? 'naming,spelling,dependencies' : part));
            await install(sandbox.path, kept, environment);
            const stub = await Bun.file(`${sandbox.path}/pyrightconfig.json`).text();
            expect(stub).toContain('"extends": "./.gspot/basedpyrightconfig.json"');
            expect(stub).not.toContain('basic');
            const policy = await Bun.file(`${sandbox.path}/gspot.toml`).text();
            expect(policy).toContain('planted/skipped.py');
            expect(policy).not.toContain('.venv');
            expect(await Bun.file(`${sandbox.path}/.gspot/baselines/basedpyright.root.json`).exists()).toBe(true);
            const held = await run(sandbox.path, ['check', '--only', 'python/basedpyright', '--no-cache'], environment);
            expect(held.code, held.stdout + held.stderr).toBe(0);
            const current = await run(
                sandbox.path,
                ['check', '--only', 'integrity/baselines-current', '--no-cache'],
                environment,
            );
            expect(current.code, current.stdout + current.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
