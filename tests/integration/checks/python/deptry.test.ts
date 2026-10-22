import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGit } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, parseCheckReport, installGeneratedTools } from '#tests/setup/cli/commands.ts';

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
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': project + exclusions,
        'src/main.py': 'import undeclared_example\n',
        'generated/client.py': 'import generated_dependency\n',
        'vendor/client.py': 'import vendor_dependency\n',
    });

    await installGeneratedTools(sandbox.path);
    const commandArguments = ['check', '--only', 'python/deptry', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = failed.report.checks[0]!.findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'src/main.py', rule: 'DEP001', line: 1 });
    await writeFile(join(sandbox.path, 'src/main.py'), 'import json\nprint(json.dumps({"ready": True}))\n');
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks[0]).toMatchObject({
        status: 'passed',
        findings: [],
    });
    const initialized = runGit(sandbox.path, ['init', '-q']);
    expect(initialized.code, initialized.stderr).toBe(0);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const primed = await spawnGspot(sandbox.path, commandArguments);
    expect(primed.code, primed.stdout + primed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'pyproject.toml'), project + exclusions.replace('"^vendor/"', '"^other/"'));
    const changed = parseCheckReport(await spawnGspot(sandbox.path, commandArguments));
    expect(changed.code, changed.stdout + changed.stderr).toBe(1);
    expect(changed.report.checks[0]!.findings).toMatchObject([{ file: 'vendor/client.py', rule: 'DEP001', line: 1 }]);
});
