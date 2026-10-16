import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { ANSIBLE_CASES, ANSIBLE_SANDBOX, ANSIBLE_PLAYBOOK, COMMAND_PLAYBOOK } from '#tests/data/checks/ansible.ts';

// The pinned ansible-lint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('ansible-lint'))('ansible-lint checks each scope without ansible.cfg', async () => {
    const level = 'all' as const;
    const sandbox = { path: installedSandbox().root };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(ANSIBLE_SANDBOX.files, {
            'gspot.toml': buildSettingsText(['ansible'], {
                level,
                tables: `[[scope]]
path = "app"

configurations = ["ansible"]
`,
            }),
            'requirements.yml': 'collections: []\n',
            'site.yml': COMMAND_PLAYBOOK,
            'app/requirements.yml': 'collections: []\n',
            'app/site.yml': COMMAND_PLAYBOOK,
        }),
    );
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failedCommand = await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']);
    const failed = JSON.parse(failedCommand.stdout) as RunReport;
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
    await Bun.write(join(sandbox.path, 'site.yml'), ANSIBLE_PLAYBOOK);
    await Bun.write(join(sandbox.path, 'app/site.yml'), ANSIBLE_PLAYBOOK);
    const correctedCommand = await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']);
    const corrected = JSON.parse(correctedCommand.stdout) as RunReport;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
});

// The pinned ansible-lint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('ansible-lint')).each([...LEVELS])(
    'ansible-lint uses the profile of level %s next to the root and scope ansible.cfg files',
    async (level) => {
        const sandbox = { path: installedSandbox().root };
        const source = ANSIBLE_PLAYBOOK.replace('ansible.builtin.systemd:', 'systemd:');
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSettingsText(['ansible'], {
                    level,
                    tables: `[[scope]]
path = "app"

configurations = ["ansible"]
`,
                }),
                'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'deploy/site.yml': source,
                'app/deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'app/deploy/site.yml': source,
            },
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const checkedCommand = await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']);
        const checked = JSON.parse(checkedCommand.stdout) as RunReport;
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
        await Bun.write(join(sandbox.path, 'deploy/site.yml'), ANSIBLE_PLAYBOOK);
        await Bun.write(join(sandbox.path, 'app/deploy/site.yml'), ANSIBLE_PLAYBOOK);
        const fixedCommand = await spawnGspot(sandbox.path, ['check', '--only', 'ansible/ansible-lint', '--json']);
        const fixed = JSON.parse(fixedCommand.stdout) as RunReport;
        expect(fixed.exitCode, JSON.stringify(fixed)).toBe(0);
    },
);

const installedSandbox = registerSharedSandbox(ANSIBLE_SANDBOX);

for (const entry of ANSIBLE_CASES) {
    // The pinned ansible-lint tool has no build for some operating systems.
    test.skipIf(!hasToolBuild('ansible-lint'))(
        `${entry.check} reports ${entry.expected.file} and passes after the fix`,
        async () => {
            const result = await runCheckSample(installedSandbox(), entry, ANSIBLE_SANDBOX);
            expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
        },
    );
}
