// Sandbox for the ansible configuration: a task that shells out to systemctl.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { detectConfigurations } from '#cli/configurations/selection/contracts.ts';
import { CLEAN, SHELLED } from '#tests/config/tools/configurations/tool/ansible.ts';

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
        const failed = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['ansible/lint'] }));
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
            buildRunOptions({ stage: 'commit', only: ['ansible/lint'] }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    },
);
