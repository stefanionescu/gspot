import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { doctorOutputSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('doctor and gspot check both report the missing program of a command check', async () => {
    const program = 'node_modules/.bin/link-checker';
    const tables = stringify({
        command_check: [{ id: 'docs/dead-links', command: [program, '{file}'], paths: ['*.md'], stage: 'commit' }],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'README.md': '# Example\n',
    });
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect(
        doctorOutputSchema.parse(JSON.parse(doctor.stdout)).tools.find(({ name }) => name === program),
    ).toMatchObject({
        name: program,
        kind: 'program',
        state: 'missing',
    });
    const text = await runGspot(sandbox.path, ['doctor']);
    expect(text.stdout).toMatch(/^ {2}missing +node_modules\/\.bin\/link-checker +Install /mu);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'docs/dead-links', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([{ check: 'docs/dead-links', status: 'missing' }]);
});
