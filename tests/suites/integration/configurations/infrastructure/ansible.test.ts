import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { ANSIBLE_CONFIG, ANSIBLE_PLAYBOOK, ANSIBLE_SANDBOX } from '#tests/config/integration/infrastructure.ts';
import { COMMAND_PLAYBOOK } from '#tests/config/setup/configurations.ts';
import { listFindingRows, listScopeFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import type { Sandbox } from '#tests/types/setup.ts';

describe.skipIf(!hasToolBuild('ansible-lint'))('ansible-lint', () => {
    const installedSandbox = shareInstalledSandbox(ANSIBLE_SANDBOX);

    test('reports command-instead-of-module in the root and in a scope without ansible.cfg, and passes after the fix', async () => {
        const { root } = installedSandbox();
        await using _sourceChange = await writeSandboxChanges(
            installedSandbox(),
            buildSandboxChanges(ANSIBLE_SANDBOX.files, {
                'gspot.toml': buildSandboxSettings(['ansible'], {
                    level: 'all',
                    scopes: [{ path: 'app', configurations: ['ansible'] }],
                }),
                'requirements.yml': 'collections: []\n',
                'site.yml': COMMAND_PLAYBOOK,
                'app/requirements.yml': 'collections: []\n',
                'app/site.yml': COMMAND_PLAYBOOK,
            }),
        );

        const failed = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
        ).report;
        expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
        expect(listScopeFindingRows(failed)).toStrictEqual([
            { scope: '', file: 'site.yml', line: 5, rule: 'command-instead-of-module' },
            { scope: 'app', file: 'app/site.yml', line: 5, rule: 'command-instead-of-module' },
        ]);
        await writeFile(join(root, 'site.yml'), ANSIBLE_PLAYBOOK);
        await writeFile(join(root, 'app/site.yml'), ANSIBLE_PLAYBOOK);
        const corrected = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
        ).report;
        expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
    });

    test('uses the profile of level all next to the root and scope ansible.cfg files', async () => {
        await assertLevelProfile(installedSandbox());
    });
});

async function assertLevelProfile(sandbox: Sandbox): Promise<void> {
    const { root } = sandbox;
    const source = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');
    await using _sourceChange = await writeSandboxChanges(sandbox, {
        files: {
            'gspot.toml': buildSandboxSettings(['ansible'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: ['ansible'] }],
            }),
            'deploy/ansible.cfg': ANSIBLE_CONFIG,
            'deploy/site.yml': source,
            'app/deploy/ansible.cfg': ANSIBLE_CONFIG,
            'app/deploy/site.yml': source,
        },
    });

    const checked = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint-production', '--json']),
    ).report;
    expect(checked.exitCode, JSON.stringify(checked)).toBe(1);
    expect(listFindingRows(checked)).toStrictEqual([
        { file: 'deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
        { file: 'app/deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
    ]);
    await writeFile(join(root, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
    await writeFile(join(root, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
    const fixed = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint-production', '--json']),
    ).report;
    expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
}
