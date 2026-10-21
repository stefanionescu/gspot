import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/system.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { ANSIBLE_SANDBOX, ANSIBLE_PLAYBOOK, COMMAND_PLAYBOOK } from '#tests/data/checks/ansible.ts';

test.skipIf(!hasToolBuild('ansible-lint'))('ansible-lint checks each scope without ansible.cfg', async () => {
    const level = 'all' as const;
    const sandbox = { path: installedSandbox!().root };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox!(),
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
        await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']),
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
    await writeFile(join(sandbox.path, 'site.yml'), ANSIBLE_PLAYBOOK);
    await writeFile(join(sandbox.path, 'app/site.yml'), ANSIBLE_PLAYBOOK);
    const correctedCommand = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']),
    );
    const corrected = correctedCommand.report;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
});

test.skipIf(!hasToolBuild('ansible-lint')).each([...LEVELS])(
    'ansible-lint uses the profile of level %s next to the root and scope ansible.cfg files',
    async (level) => {
        const sandbox = { path: installedSandbox!().root };
        const source = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');
        await using _sourceChange = await applySandboxChanges(installedSandbox!(), {
            check: '',
            files: {
                'gspot.toml': buildSandboxSettings(['ansible'], {
                    level,
                    scopes: [{ path: 'app', configurations: ['ansible'] }],
                }),
                'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'deploy/site.yml': source,
                'app/deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'app/deploy/site.yml': source,
            },
        });

        const checkedCommand = parseCheckReport(
            await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']),
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
        await writeFile(join(sandbox.path, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
        await writeFile(join(sandbox.path, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
        const fixedCommand = parseCheckReport(
            await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']),
        );
        const fixed = fixedCommand.report;
        expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
    },
);

// Systems without an ansible-lint build skip every test here, so they install nothing.
const installedSandbox = hasToolBuild('ansible-lint') ? registerSharedSandbox(ANSIBLE_SANDBOX) : undefined;
