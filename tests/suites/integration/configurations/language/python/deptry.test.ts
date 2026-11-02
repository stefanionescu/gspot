import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, listFindingRows, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test("deptry ignores gspot's tool folder and reads the authored exclude settings again after they change", async () => {
    await using sandbox = await createGitSandbox({});
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
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': project + exclusions,
        'src/main.py': 'import undeclared_example\n',
        'generated/client.py': 'import generated_dependency\n',
        'vendor/client.py': 'import vendor_dependency\n',
    });

    await applyThenInstall(sandbox.path);
    await runCommand(['uv', 'venv', '.venv'], { cwd: sandbox.path });
    const commandArguments = ['check', '--only', 'python/deptry', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([{ file: 'src/main.py', line: 1, rule: 'DEP001' }]);
    await writeFile(join(sandbox.path, 'src/main.py'), 'import json\nprint(json.dumps({"ready": True}))\n');
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await writeFile(join(sandbox.path, 'pyproject.toml'), project + exclusions.replace('"^vendor/"', '"^other/"'));
    const changed = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(changed.code, changed.stdout + changed.stderr).toBe(1);
    expect(listFindingRows(changed.report)).toStrictEqual([{ file: 'vendor/client.py', line: 1, rule: 'DEP001' }]);
});

test('deptry reads the project name and the packages under src as first party', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "shop-core"\nversion = "1.0.0"\ndependencies = []\n',
        'src/shop_core/__init__.py': 'from shop_tools import helper\n\nprint(helper)\n',
        'src/shop_tools/__init__.py': 'helper = 1\n',
    });
    await applyThenInstall(sandbox.path);
    await runCommand(['uv', 'venv', '.venv'], { cwd: sandbox.path });
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'python/deptry', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
