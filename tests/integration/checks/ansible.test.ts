import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { LEVELS } from '#cli/config/configurations.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import type { Level } from '#cli/types/configurations.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { ANSIBLE_CONFIG, ANSIBLE_SANDBOX, ANSIBLE_PLAYBOOK, COMMAND_PLAYBOOK } from '#tests/data/checks/ansible.ts';

/** Assert the ansible scopes behavior. */
async function assertAnsibleScopes(installedSandbox: () => Sandbox): Promise<void> {
    const level = 'all' as const;
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(ANSIBLE_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['ansible'], {
                level,
                scopes: [{ path: 'app', configurations: ['ansible'] }],
            }),
            'requirements.yml': 'collections: []\n',
            'site.yml': COMMAND_PLAYBOOK,
            'app/requirements.yml': 'collections: []\n',
            'app/site.yml': COMMAND_PLAYBOOK,
        }),
    );

    const failedCommand = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    );
    const failed = failedCommand.report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(
        failed.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            findings: findings.map(({ file, rule }) => ({ file, rule })),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', findings: [{ file: 'site.yml', rule: 'command-instead-of-module' }] },
        { scope: 'app', status: 'failed', findings: [{ file: 'app/site.yml', rule: 'command-instead-of-module' }] },
    ]);
    await writeFile(join(root, 'site.yml'), ANSIBLE_PLAYBOOK);
    await writeFile(join(root, 'app/site.yml'), ANSIBLE_PLAYBOOK);
    const correctedCommand = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    );
    const corrected = correctedCommand.report;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
}

/** Assert the ansible levels behavior. */
async function assertAnsibleLevels(installedSandbox: () => Sandbox, level: Level): Promise<void> {
    const { root } = installedSandbox();
    const source = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
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

    const checkedCommand = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    );
    const checked = checkedCommand.report;
    expect(checked.exitCode, JSON.stringify(checked)).toBe(level === 'all' ? 1 : 0);
    expect(
        checked.checks.flatMap(({ findings }) => findings.map(({ file, rule, line }) => ({ file, rule, line }))),
    ).toStrictEqual(
        level === 'all'
            ? [
                  { file: 'deploy/site.yml', rule: 'fqcn[action-core]', line: 6 },
                  { file: 'app/deploy/site.yml', rule: 'fqcn[action-core]', line: 6 },
              ]
            : [],
    );
    await writeFile(join(root, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
    await writeFile(join(root, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
    const fixedCommand = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'ansible/ansible-lint', '--json']),
    );
    const fixed = fixedCommand.report;
    expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
}

describe.skipIf(!hasToolBuild('ansible-lint'))('ansible-lint', () => {
    const installedSandbox = shareInstalledSandbox(ANSIBLE_SANDBOX);
    test(
        'ansible-lint reports command-instead-of-module in the root and in a scope without ansible.cfg, and passes after the fix',
        assertAnsibleScopes.bind(undefined, installedSandbox),
    );

    test.each([...LEVELS])(
        'ansible-lint uses the profile of level %s next to the root and scope ansible.cfg files',
        assertAnsibleLevels.bind(undefined, installedSandbox),
    );
});
