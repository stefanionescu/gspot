import { chmodSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { WORKFLOW_HEAD } from '#tests/samples/actions.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const TOOL_FAILURES_POLICY = policyOf(['files', 'actions'], 'runner = "mise"\n[rules]\ninstall = false\n', 'all');

const PINACT_STUB = `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args.includes('--version')) {
    console.log('pinact 5.0.0');
    process.exit(0);
}
if (!args.includes('--verify-comment')) process.exit(0);
const file = Bun.file(args.at(-1));
const content = await file.text();
if (!args.includes('--check')) await Bun.write(file, 'rewritten by pinact');
if (content.includes('actions/checkout@0000000000000000000000000000000000000000')) {
    console.error('invalid action pin: broken.yml');
    process.exit(3);
}
`;

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
        const result = await runGspot(sandbox.path, ['check', '--only', 'files/taplo-format'], environment);
        expect(result.code, result.stderr + result.stdout).toBe(2);
        expect(result.stdout).toContain('taplo broke: exit 2');
        expect(result.stdout).toContain('INFO taplo: loaded configuration');
        expect(result.stdout).toContain('cannot read the formatting configuration');
        await Bun.write(
            join(sandbox.path, 'bin/taplo'),
            '#!/usr/bin/env bun\nif (process.argv.includes("--version")) console.log("taplo 0.10.0");\n',
        );
        const corrected = await runGspot(
            sandbox.path,
            ['check', '--only', 'files/taplo-format', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo-format', status: 'ok', findings: [] },
        ]);
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
        const result = await runGspot(
            sandbox.path,
            ['check', '--only', 'actions/pinact', '--hook', 'push'],
            environment,
        );
        expect(result.code, result.stderr + result.stdout).toBe(1);
        expect(result.stdout).toContain('invalid action pin: broken.yml');
        expect(await Bun.file(path).text()).toBe(workflow);
        await Bun.write(path, workflow.replace('0'.repeat(40), 'a'.repeat(40)));
        const corrected = await runGspot(
            sandbox.path,
            ['check', '--only', 'actions/pinact', '--hook', 'push', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'actions/pinact', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);
