// Sandbox for the ansible configuration: a task that shells out to systemctl.
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import * as commands from '#cli/execution/command/public.ts';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { detectConfigurations } from '#cli/repository/selection/contracts.ts';
import { CLEAN, SHELLED } from '#tests/config/tools/configurations/infra/ansible.ts';

test.skipIf(!hasToolBuild('ansible-lint')).each(levelSchema.options)(
    'Ansible detects configless projects and lints each selected scope at level %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['ansible'], { level, tables: '[scope.app]\nconfigurations = ["ansible"]\n' }),
            'requirements.yml': 'collections: []\n',
            'site.yml': SHELLED,
            'app/requirements.yml': 'collections: []\n',
            'app/site.yml': SHELLED,
        });
        await sharePythonTools(sandbox.path);
        const session = await openSession(sandbox.path);
        for (const scope of ['', 'app']) {
            expect(
                detectConfigurations(sandbox.path, session.repository.files, session.manifests, [], scope).map(
                    ({ configuration }) => configuration,
                ),
            ).toContain('ansible');
        }
        const failed = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['ansible/ansible-lint'] }));
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(
            failed.report.checks.map(({ scope, status, findings }) => ({
                scope,
                status,
                findings: findings.map(({ file, rule }) => ({ file, rule })),
            })),
        ).toStrictEqual([
            { scope: '', status: 'failed', findings: [{ file: 'site.yml', rule: 'command-instead-of-module' }] },
            { scope: 'app', status: 'failed', findings: [{ file: 'app/site.yml', rule: 'command-instead-of-module' }] },
        ]);
        await Bun.write(join(sandbox.path, 'site.yml'), CLEAN);
        await Bun.write(join(sandbox.path, 'app/site.yml'), CLEAN);
        const corrected = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'commit', only: ['ansible/ansible-lint'] }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    },
);

test.skipIf(!hasToolBuild('ansible-lint')).each(levelSchema.options)(
    'Ansible applies the %s profile beside root and child configuration files',
    async (level) => {
        await using sandbox = await testdir();
        const source = CLEAN.replace('ansible.builtin.systemd:', 'systemd:');
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['ansible'], { level, tables: '[scope.app]\nconfigurations = ["ansible"]\n' }),
            'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
            'deploy/site.yml': source,
            'app/deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
            'app/deploy/site.yml': source,
        });
        await sharePythonTools(sandbox.path);
        using native = spyOn(commands, 'runCheckTool');
        const checked = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'commit', only: ['ansible/ansible-lint'] }),
        );
        expect(checked.report.exitCode, JSON.stringify(checked.report)).toBe(level === 'all' ? 1 : 0);
        expect(
            checked.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, rule, line }) => ({ file, rule, line })),
            ),
        ).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'deploy/site.yml', rule: 'fqcn[action-core]', line: 6 },
                      { file: 'app/deploy/site.yml', rule: 'fqcn[action-core]', line: 6 },
                  ]
                : [],
        );
        expect(native.mock.calls).toHaveLength(2);
        for (const [, argv] of native.mock.calls) {
            expect(argv).toStrictEqual([
                'ansible-lint',
                '--offline',
                '--nocolor',
                '-f',
                'pep8',
                '--profile',
                level === 'all' ? 'production' : 'moderate',
                '--skip-list',
                'experimental',
                'site.yml',
            ]);
        }
        await Bun.write(join(sandbox.path, 'deploy/site.yml'), CLEAN);
        await Bun.write(join(sandbox.path, 'app/deploy/site.yml'), CLEAN);
        const fixed = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'commit', only: ['ansible/ansible-lint'] }),
        );
        expect(fixed.report.exitCode, JSON.stringify(fixed.report)).toBe(0);
    },
);
