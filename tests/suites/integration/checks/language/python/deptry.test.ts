import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, listFindingRows, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test("deptry ignores gspot's tool folder and reads your exclude settings again after they change", async () => {
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
