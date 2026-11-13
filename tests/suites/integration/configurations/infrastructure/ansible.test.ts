import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { COMMAND_PLAYBOOK } from '#tests/config/setup/configurations.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { hasToolBuild } from '#tests/setup/cli/tools.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const ANSIBLE_CONFIG = '[defaults]\ninventory = inventory\n';

const ANSIBLE_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.systemd:
        name: test
        state: restarted
`;

const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    files: { 'deploy/ansible.cfg': ANSIBLE_CONFIG, 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;

const ANSIBLE_LINT_CHECK = ['check', '--only', 'ansible/ansible-lint', '--json'] as const;

const SHORT_ACTION_PLAYBOOK = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');

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

        const failed = parseCheckReport(await spawnGspot(root, ANSIBLE_LINT_CHECK)).report;
        expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.checks.map(({ scope }) => scope)).toStrictEqual(['', 'app']);
        expect(listFindingRows(failed)).toStrictEqual([
            { file: 'site.yml', line: 5, rule: 'command-instead-of-module' },
            { file: 'app/site.yml', line: 5, rule: 'command-instead-of-module' },
        ]);
        await writeFile(join(root, 'site.yml'), ANSIBLE_PLAYBOOK);
        await writeFile(join(root, 'app/site.yml'), ANSIBLE_PLAYBOOK);
        const corrected = parseCheckReport(await spawnGspot(root, ANSIBLE_LINT_CHECK)).report;
        expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
    });

    test('uses the profile of level all next to the root and scope ansible.cfg files', async () => {
        const { root } = installedSandbox();
        await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
            files: {
                'gspot.toml': buildSandboxSettings(['ansible'], {
                    level: 'all',
                    scopes: [{ path: 'app', configurations: ['ansible'] }],
                }),
                'deploy/ansible.cfg': ANSIBLE_CONFIG,
                'deploy/site.yml': SHORT_ACTION_PLAYBOOK,
                'app/deploy/ansible.cfg': ANSIBLE_CONFIG,
                'app/deploy/site.yml': SHORT_ACTION_PLAYBOOK,
            },
        });

        const checked = parseCheckReport(await spawnGspot(root, ANSIBLE_LINT_CHECK)).report;
        expect(checked.exitCode, JSON.stringify(checked)).toBe(1);
        expect(listFindingRows(checked)).toStrictEqual([
            { file: 'deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
            { file: 'app/deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
        ]);
        await writeFile(join(root, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
        await writeFile(join(root, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
        const fixed = parseCheckReport(await spawnGspot(root, ANSIBLE_LINT_CHECK)).report;
        expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
    });
});
