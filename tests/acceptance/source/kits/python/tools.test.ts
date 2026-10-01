// Planted repository for the python configuration: a lint finding, a layout finding, a type error, a stale docstring, a requirements file.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { run as runCommand } from '#cli/platform/spawn.ts';
import { containing } from '#tests/support/expectations.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

import {
    TOOLS_CLEAN,
    TOOLS_MODULE,
    TOOLS_PROJECT,
    STRUCTURE_INIT,
} from '#tests/inputs/acceptance/source/kits/python.ts';

// What each check accepts beside the clean module.
const CORRECTIONS: Record<string, Record<string, string>> = {
    'python/vulture': { 'planted/unused.py': '"""No unused imports."""\n' },
    'integrity/dependency-ownership': {
        'uv.lock': 'version = 1\n',
        'scripts/setup.sh': '#!/usr/bin/env bash\nprintf "Dependencies are owned by pyproject.toml\\n"\n',
    },
    'integrity/typecheck-membership': { 'planted/gone.py': '"""A file with a separate dependency set."""\n' },
};
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

test(
    'deptry excludes private tools without Git and preserves authored exclusions beside real findings',
    async () => {
        await using sandbox = await testdir();
        const project = '[project]\nname = "dependency-example"\nversion = "1.0.0"\ndependencies = []\n';
        const exclusions = '\n[tool.deptry]\nexclude = ["^generated/"]\nextend_exclude = ["^vendor/"]\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['python']),
            'pyproject.toml': project + exclusions,
            'src/main.py': 'import undeclared_example\n',
            'generated/client.py': 'import generated_dependency\n',
            'vendor/client.py': 'import vendor_dependency\n',
        });
        for (const command of ['apply', 'install']) {
            const prepared = await run(sandbox.path, [command]);
            expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
        }
        const args = ['check', '--only', 'python/deptry', '--json'];
        const failed = await run(sandbox.path, args);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks[0]!.findings;
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'src/main.py', rule: 'DEP001', line: 1 });
        await Bun.write(join(sandbox.path, 'src/main.py'), 'import json\nprint(json.dumps({"ready": True}))\n');
        const corrected = await run(sandbox.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks[0]).toMatchObject({
            status: 'ok',
            findings: [],
        });
        const initialized = await runCommand(['git', 'init', '-q'], { cwd: sandbox.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const primed = await run(sandbox.path, args);
        expect(primed.code, primed.stdout + primed.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'pyproject.toml'), project + exclusions.replace('"^vendor/"', '"^other/"'));
        const changed = await run(sandbox.path, args);
        expect(changed.code, changed.stdout + changed.stderr).toBe(1);
        expect((JSON.parse(changed.stdout) as RunReport).checks[0]!.findings).toMatchObject([
            { file: 'vendor/client.py', rule: 'DEP001', line: 1 },
        ]);
    },
    PLANTED_TIMEOUT_MS * 3,
);

plantedCases(
    'the python configuration',
    {
        kits: ['python'],
        modules: false,
        without: ['naming', 'spelling', 'dependencies'],
        tools: ['ruff', 'basedpyright'],
        files: {
            'pyproject.toml': TOOLS_PROJECT,
            'planted/__init__.py': '"""The planted package."""\n',
            [TOOLS_MODULE]: TOOLS_CLEAN,
        },
        corrected: (planted) => ({ files: { ...CORRECTIONS[planted.check], [TOOLS_MODULE]: TOOLS_CLEAN } }),
    },
    CASES,
);

test(
    'the python configuration > init replaces an authored Pyright configuration with the pointer, and the check reports the type error',
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
        await install(sandbox.path, STRUCTURE_INIT, environment);
        // The authored file is gone; the pointer stands in its place, and the policy carries none of its settings.
        const pointer = await Bun.file(`${sandbox.path}/pyrightconfig.json`).text();
        expect(pointer).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
        expect(pointer).not.toContain('basic');
        const policy = await Bun.file(`${sandbox.path}/gspot.toml`).text();
        expect(policy).not.toContain('planted/skipped.py');
        const command = ['check', '--only', 'python/basedpyright', '--json'];
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
