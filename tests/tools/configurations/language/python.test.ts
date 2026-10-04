// Test repository for the python configuration: a lint finding, a layout finding, a type error, a stale docstring, a requirements file.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { containing, expectCheckCase } from '#tests/harness/expectations.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { MODULE_PATH, CLEAN_MODULE, EXCLUDED_CONFIGURATIONS } from '#tests/config/samples/python/source.ts';
import { CASES, REPOSITORY, CORRECTIONS, TOOLS_PROJECT } from '#tests/config/tools/configurations/language/python.ts';

test(
    'deptry excludes private tools without Git and preserves authored exclusions beside real findings',
    async () => {
        await using sandbox = await testdir();
        const project = '[project]\nname = "dependency-example"\nversion = "1.0.0"\ndependencies = []\n';
        const exclusions = '\n[tool.deptry]\nexclude = ["^generated/"]\nextend_exclude = ["^vendor/"]\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python']),
            'pyproject.toml': project + exclusions,
            'src/main.py': 'import undeclared_example\n',
            'generated/client.py': 'import generated_dependency\n',
            'vendor/client.py': 'import vendor_dependency\n',
        });
        for (const command of ['apply', 'install']) {
            const prepared = await spawnGspot(sandbox.path, [command]);
            expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
        }
        const args = ['check', '--only', 'python/deptry', '--json'];
        const failed = await spawnGspot(sandbox.path, args);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks[0]!.findings;
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'src/main.py', rule: 'DEP001', line: 1 });
        await Bun.write(join(sandbox.path, 'src/main.py'), 'import json\nprint(json.dumps({"ready": True}))\n');
        const corrected = await spawnGspot(sandbox.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks[0]).toMatchObject({
            status: 'passed',
            findings: [],
        });
        const initialized = await runTestCommand(['git', 'init', '-q'], { cwd: sandbox.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const primed = await spawnGspot(sandbox.path, args);
        expect(primed.code, primed.stdout + primed.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'pyproject.toml'), project + exclusions.replace('"^vendor/"', '"^other/"'));
        const changed = await spawnGspot(sandbox.path, args);
        expect(changed.code, changed.stdout + changed.stderr).toBe(1);
        expect((JSON.parse(changed.stdout) as RunReport).checks[0]!.findings).toMatchObject([
            { file: 'vendor/client.py', rule: 'DEP001', line: 1 },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

describe('the python configuration', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        corrected: (entry) => ({ files: { ...CORRECTIONS[entry.check], [MODULE_PATH]: CLEAN_MODULE } }),
    };
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                await expectCheckCase(testRepository, entry, repository);
            },
            suiteTimeout(),
        );
    }
});

test(
    'the python configuration > init replaces an authored Pyright configuration with the pointer, and the check reports the type error',
    async () => {
        const typed = `${CLEAN_MODULE}\n\nTOTAL: int = "three"\n`;
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'pyproject.toml': TOOLS_PROJECT,
            'pyrightconfig.json':
                '{\n    "typeCheckingMode": "basic",\n    "exclude": [".venv", "example/skipped.py"]\n}\n',
            'example/__init__.py': '"""The test package."""\n',
            'example/skipped.py': '"""A file the old setup left out."""\n',
            [MODULE_PATH]: typed,
        });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['ruff', 'basedpyright', 'typos', 'ec']) };
        await install(sandbox.path, buildInitArguments(['python']), environment, { without: EXCLUDED_CONFIGURATIONS });
        // The authored file is gone; the pointer stands in its place, and the policy carries none of its settings.
        const pointer = await Bun.file(`${sandbox.path}/pyrightconfig.json`).text();
        expect(pointer).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
        expect(pointer).not.toContain('basic');
        const policy = await Bun.file(`${sandbox.path}/gspot.toml`).text();
        expect(policy).not.toContain('example/skipped.py');
        const command = ['check', '--only', 'python/basedpyright', '--json'];
        const refused = await spawnGspot(sandbox.path, command, environment);
        expect(refused.code, refused.stdout + refused.stderr).toBe(1);
        const report = JSON.parse(refused.stdout) as RunReport;
        expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
            ['python/basedpyright', 'failed'],
        ]);
        expect(report.checks[0]?.findings).toContainEqual(
            containing({
                file: MODULE_PATH,
                rule: 'reportAssignmentType',
            }),
        );
        await Bun.write(`${sandbox.path}/${MODULE_PATH}`, `${CLEAN_MODULE}\n\nTOTAL: int = 3\n`);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const accepted = JSON.parse(corrected.stdout) as RunReport;
        expect(accepted.checks.map((check) => [check.check, check.status])).toStrictEqual([
            ['python/basedpyright', 'passed'],
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
