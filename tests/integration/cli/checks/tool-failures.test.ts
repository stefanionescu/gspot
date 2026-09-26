import { chmodSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { expectCorrected } from '#tests/support/cli/planted.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { PINACT_STUB, TOOL_FAILURES_POLICY } from '#tests/constants/integration/cli/checks.ts';
import { WORKFLOW_HEAD } from '#tests/constants/acceptance/source/configurations/configurations.ts';

test(
    'the Taplo adapter reports both output streams and its exit code',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': TOOL_FAILURES_POLICY,
            'settings/layout.toml': 'a = 1\n',
            'bin/taplo': `#!/usr/bin/env bun
if (process.argv.includes('--version')) {
    console.log('taplo 0.10.0');
    process.exit(0);
}
console.error('INFO taplo: loaded configuration');
console.log('ERROR taplo: cannot read the formatting configuration');
process.exit(2);
`,
            'bin/taplo.cmd': '@echo off\r\nbun "%~dp0taplo" %*\r\n',
        });
        chmodSync(join(sandbox.path, 'bin/taplo'), 0o755);
        commitAll(sandbox.path);
        const environment = {
            PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        };
        const result = await run(sandbox.path, ['check', '--only', 'configs/toml-format', '--no-cache'], environment);
        expect(result.code, result.stderr + result.stdout).toBe(2);
        expect(result.stdout).toContain('taplo broke: exit 2');
        expect(result.stdout).toContain('INFO taplo: loaded configuration');
        expect(result.stdout).toContain('cannot read the formatting configuration');
        await Bun.write(
            join(sandbox.path, 'bin/taplo'),
            '#!/usr/bin/env bun\nif (process.argv.includes("--version")) console.log("taplo 0.10.0");\n',
        );
        await expectCorrected(sandbox.path, 'configs/toml-format', environment);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'the pin verification adapter reports a rejected commit and preserves the workflow',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': TOOL_FAILURES_POLICY,
            'README.md': '# Action pins\n',
            'bin/pinact': PINACT_STUB,
            'bin/pinact.cmd': '@echo off\r\nbun "%~dp0pinact" %*\r\n',
        });
        chmodSync(join(sandbox.path, 'bin/pinact'), 0o755);
        commitAll(sandbox.path);
        const environment = {
            PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        };
        const path = join(sandbox.path, '.github/workflows/broken.yml');
        const workflow = `${WORKFLOW_HEAD}            - uses: actions/checkout@0000000000000000000000000000000000000000\n`;
        await Bun.write(path, workflow);
        const result = await run(
            sandbox.path,
            ['check', '--only', 'configs/actions-pins', '--stage', 'push', '--no-cache'],
            environment,
        );
        expect(result.code, result.stderr + result.stdout).toBe(1);
        expect(result.stdout).toContain('invalid action pin: broken.yml');
        expect(await Bun.file(path).text()).toBe(workflow);
        await Bun.write(path, workflow.replace('0'.repeat(40), 'a'.repeat(40)));
        const corrected = await run(
            sandbox.path,
            ['check', '--only', 'configs/actions-pins', '--stage', 'push', '--no-cache', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'configs/actions-pins', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);
