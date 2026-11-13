import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import * as processes from '#cli/system/processes/run.ts';
import { getBuiltInCheck, openFakeToolSession, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildPythonToolFiles, buildVenvExecutablePath } from '#tests/setup/cli/tools.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('each Ansible project lints its own files and not those of a nested project', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['ansible']),
        'infra/ansible.cfg': '[defaults]\n',
        'infra/site.yml': '',
        'infra/edge/ansible.cfg': '[defaults]\n',
        'infra/edge/site.yml': '',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['ansible-lint'], resources);
    await createFileTree(sandbox.path, {
        [buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'ansible-lint')]: 'stub',
        ...buildPythonToolFiles('ansible-lint'),
    });
    const input = planSandboxCheck(session, 'ansible/ansible-lint');
    resources.use(
        spyOn(processes, 'runProcess').mockImplementation(() =>
            Promise.resolve(
                buildProcessResult({
                    code: 2,
                    stdout: [
                        'site.yml:1: command-instead-of-module: Use an Ansible module.',
                        'edge/site.yml:1: command-instead-of-module: Use an Ansible module.',
                    ].join('\n'),
                }),
            ),
        ),
    );
    const findings = await getBuiltInCheck('ansible/ansible-lint')(session, input);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'infra/site.yml', rule: 'command-instead-of-module' },
        { file: 'infra/edge/site.yml', rule: 'command-instead-of-module' },
    ]);
});
