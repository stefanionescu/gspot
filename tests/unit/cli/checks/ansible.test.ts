import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { checkAnsibleLint } from '#cli/checks/ansible.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { COMMAND_PLAYBOOK } from '#tests/data/checks/ansible.ts';
import { buildCheckInput, openPinnedSession } from '#tests/setup/check-input.ts';

test('each Ansible project lints its own files and not those of a nested project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['ansible']),
        'infra/ansible.cfg': '[defaults]\n',
        'infra/site.yml': COMMAND_PLAYBOOK,
        'infra/edge/ansible.cfg': '[defaults]\n',
        'infra/edge/site.yml': COMMAND_PLAYBOOK,
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['ansible-lint'], resources);
    resources.use(session.resources);
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath('.gspot/.venv', 'ansible-lint')]: 'fixture',
    });
    const input = buildCheckInput(session, 'ansible/ansible-lint');
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command) =>
            Promise.resolve(
                buildProcessResult({
                    code: 2,
                    stdout: command
                        .filter((part) => part.endsWith('site.yml'))
                        .map((file) => `${file}:1: command-instead-of-module: Use an Ansible module.`)
                        .join('\n'),
                }),
            ),
        ),
    );
    const findings = await checkAnsibleLint(input);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'infra/site.yml', rule: 'command-instead-of-module' },
        { file: 'infra/edge/site.yml', rule: 'command-instead-of-module' },
    ]);
    expect(
        run.mock.calls.map(([command, options]) => ({
            cwd: options.cwd,
            files: command.filter((part) => part.endsWith('site.yml')),
        })),
    ).toStrictEqual([
        { cwd: join(sandbox.path, 'infra'), files: ['site.yml'] },
        { cwd: join(sandbox.path, 'infra', 'edge'), files: ['site.yml'] },
    ]);
});
