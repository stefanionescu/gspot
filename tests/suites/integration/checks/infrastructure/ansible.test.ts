import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import type { Level } from '#cli/types/manifests.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { COMMAND_PLAYBOOK } from '#tests/config/ansible.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { spawnGspot, listFindingRows, parseCheckReport, listScopeFindingRows } from '#tests/setup/cli/commands.ts';
import { ANSIBLE_CONFIG, ANSIBLE_SANDBOX, ANSIBLE_PLAYBOOK } from '#tests/config/integration/checks/infrastructure.ts';

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

    test.each([...LEVELS])(
        'uses the profile of level %s next to the root and scope ansible.cfg files',
        async (level) => {
            await assertLevelProfile(installedSandbox(), level);
        },
    );
});

async function assertLevelProfile(sandbox: Sandbox, level: Level): Promise<void> {
    const { root } = sandbox;
    const source = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');
    await using _sourceChange = await writeSandboxChanges(sandbox, {
        files: {
            'gspot.toml': buildSandboxSettings(['ansible'], {
                level,
                scopes: [{ path: 'app', configurations: ['ansible'] }],
            }),
            'deploy/ansible.cfg': ANSIBLE_CONFIG,
            'deploy/site.yml': source,
            'app/deploy/ansible.cfg': ANSIBLE_CONFIG,
            'app/deploy/site.yml': source,
        },
    });

    const checked = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    ).report;
    expect(checked.exitCode, JSON.stringify(checked)).toBe(level === 'all' ? 1 : 0);
    expect(listFindingRows(checked)).toStrictEqual(
        level === 'all'
            ? [
                  { file: 'deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
                  { file: 'app/deploy/site.yml', line: 6, rule: 'fqcn[action-core]' },
              ]
            : [],
    );
    await writeFile(join(root, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
    await writeFile(join(root, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
    const fixed = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    ).report;
    expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
}
