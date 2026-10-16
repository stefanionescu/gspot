import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGit } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { PYPROJECT } from '#tests/data/checks/python/project.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    IMPORT_PACKAGE_FILES,
    IMPORT_LINTER_SANDBOX,
    IMPORT_CONFIGURATIONS,
    IMPORT_SCOPE_SETTINGS,
} from '#tests/data/checks/python/imports.ts';

test("deptry ignores gspot's tool folder without Git and keeps your exclude settings", async () => {
    await using sandbox = await testdir();
    const project = `[project]
name = "dependency-example"
version = "1.0.0"
dependencies = []
`;
    const exclusions = `
[tool.deptry]
exclude = ["^generated/"]
extend_exclude = ["^vendor/"]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python']),
        'pyproject.toml': project + exclusions,
        'src/main.py': 'import undeclared_example\n',
        'generated/client.py': 'import generated_dependency\n',
        'vendor/client.py': 'import vendor_dependency\n',
    });

    await installToolProjects(sandbox.path);
    const commandArguments = ['check', '--only', 'python/deptry', '--json'];
    const failed = await spawnGspot(sandbox.path, commandArguments);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = (JSON.parse(failed.stdout) as RunReport).checks[0]!.findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'src/main.py', rule: 'DEP001', line: 1 });
    await Bun.write(join(sandbox.path, 'src/main.py'), 'import json\nprint(json.dumps({"ready": True}))\n');
    const corrected = await spawnGspot(sandbox.path, commandArguments);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks[0]).toMatchObject({
        status: 'passed',
        findings: [],
    });
    const initialized = runGit(sandbox.path, ['init', '-q']);
    expect(initialized.code, initialized.stderr).toBe(0);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const primed = await spawnGspot(sandbox.path, commandArguments);
    expect(primed.code, primed.stdout + primed.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'pyproject.toml'), project + exclusions.replace('"^vendor/"', '"^other/"'));
    const changed = await spawnGspot(sandbox.path, commandArguments);
    expect(changed.code, changed.stdout + changed.stderr).toBe(1);
    expect((JSON.parse(changed.stdout) as RunReport).checks[0]!.findings).toMatchObject([
        { file: 'vendor/client.py', rule: 'DEP001', line: 1 },
    ]);
});

const installedSandbox = registerSharedSandbox(IMPORT_LINTER_SANDBOX);

test.each([...IMPORT_CONFIGURATIONS])(
    'import-linter reads $file and reports the forbidden import in each scope',
    async ({ file, text }) => {
        const sandbox = { path: installedSandbox().root };
        const files = {
            ...IMPORT_PACKAGE_FILES,
            ...Object.fromEntries(
                ['', 'app/'].map((scope) => [scope + file, file === 'pyproject.toml' ? PYPROJECT + text : text]),
            ),
        };
        await using _change = await updateSandbox(installedSandbox(), {
            check: '',
            files: { 'gspot.toml': buildSettingsText(['python'], { tables: IMPORT_SCOPE_SETTINGS }), ...files },
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const commandArguments = ['check', '--only', 'python/import-linter', '--json'];
        const failed = await spawnGspot(sandbox.path, commandArguments);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const checks = (JSON.parse(failed.stdout) as RunReport).checks;
        expect(checks.map((check) => [check.scope, check.status])).toStrictEqual([
            ['', 'failed'],
            ['app', 'failed'],
        ]);
        for (const scope of ['', 'app/']) {
            const finding = checks.flatMap((check) => check.findings).find((entry) => entry.file === scope + file);
            expect(finding?.message).toContain('example.low -> example.high (l.1)');
            expect(await Bun.file(join(sandbox.path, scope + file)).text()).toBe(files[scope + file]!);
            await Bun.write(join(sandbox.path, scope + 'example/low.py'), 'VALUE = 1\n');
        }
        const corrected = await spawnGspot(sandbox.path, commandArguments);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map((check) => [
                check.scope,
                check.status,
                check.findings,
            ]),
        ).toStrictEqual([
            ['', 'passed', []],
            ['app', 'passed', []],
        ]);
    },
);
