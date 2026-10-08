import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installToolProjects } from '#tests/harness/install.ts';

import {
    YAML_SCOPE_FILES,
    YAML_SCOPE_DEFECT,
    YAML_SCOPE_TABLES,
} from '#tests/config/tools/configurations/general/yaml.ts';

// Every phase checks the root and child independently through the same native contract.
async function expectYamlFiles(root: string, rule?: string): Promise<void> {
    const checked = await spawnGspot(root, ['check', '--only', 'files/yamllint', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(rule === undefined ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/yamllint', scope: '', status: 'passed', findings: [] },
        {
            check: 'files/yamllint',
            scope: 'app',
            status: rule === undefined ? 'passed' : 'failed',
            findings: rule === undefined ? [] : [containing({ file: 'app/settings/project.yaml', rule, line: 2 })],
        },
    ]);
}

test('native YAML keeps scoped options and formatter width through recommended/all transitions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: YAML_SCOPE_TABLES }),
        ...YAML_SCOPE_FILES,
    });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    for (const level of ['recommended', 'all', 'recommended']) {
        const selected = await spawnGspot(sandbox.path, ['set', 'level', level]);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await expectYamlFiles(sandbox.path);
        const formatted = await spawnGspot(sandbox.path, ['check', '--only', 'format/prettier', '--json']);
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
        expect((JSON.parse(formatted.stdout) as RunReport).checks).toMatchObject([
            { check: 'format/prettier', scope: '', status: 'passed', findings: [] },
        ]);
        await Bun.write(join(sandbox.path, 'app/settings/project.yaml'), YAML_SCOPE_DEFECT);
        await expectYamlFiles(sandbox.path, 'truthy');
        await Bun.write(join(sandbox.path, 'app/settings/project.yaml'), YAML_SCOPE_FILES['app/settings/project.yaml']);
        await expectYamlFiles(sandbox.path);
    }
});
