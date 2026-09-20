// The config-files preset: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import { chmodSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { delimiter, join } from 'node:path';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { environmentVariables } from '#cli/platform/environment.ts';

import {
    commitAll,
    git,
    install,
    toolsPath,
    PLANTED_TIMEOUT_MS,
    run,
    runPlanted,
    script,
} from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'config-files',
    '--runner',
    'none',
    '--ci',
    'none',
    '--no-rules',
    '--no-install',
];

const WORKFLOW_HEAD =
    'name: planted\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';

const PINACT_STUB = `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args.includes('--version')) {
    console.log('pinact 5.0.0');
    process.exit(0);
}
if (!args.includes('--verify')) process.exit(0);
const file = Bun.file(args.at(-1));
const content = await file.text();
if (!args.includes('--check')) await Bun.write(file, 'rewritten by pinact');
if (content.includes('actions/checkout@0000000000000000000000000000000000000000')) {
    console.error('invalid action pin: broken.yml');
    process.exit(3);
}
`;

const CASES: PlantedCase[] = [
    {
        id: 'config-files/toml-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: 'settings/layout.toml',
    },
    {
        id: 'config-files/actions',
        files: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo "\${{ nothing.here }}"\n` },
        expected: 'broken.yml',
    },
    {
        id: 'config-files/actions-security',
        files: {
            '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - uses: actions/checkout@v4\n            - run: echo "\${{ github.event.pull_request.title }}"\n`,
        },
        expected: 'unpinned.yml',
    },
    {
        id: 'config-files/dotenv',
        files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
        expected: '.env.example',
    },
    { id: 'config-files/xml', files: { 'settings/feed.xml': '<feed><entry></feed>\n' }, expected: 'settings/feed.xml' },
];

describe('the config-files preset', () => {
    test(
        'a tool crash reports the cause after its informational output',
        async () => {
            await using fixture = await createFixture({
                'settings/layout.toml': 'a = 1\n',
                'bin/taplo': `#!/usr/bin/env bun
if (process.argv.includes('--version')) {
    console.log('taplo 0.10.0');
    process.exit(0);
}
console.error('INFO taplo: loaded configuration');
console.error('ERROR taplo: cannot read the formatting configuration');
process.exit(2);
`,
                'bin/taplo.cmd': '@echo off\r\nbun "%~dp0taplo" %*\r\n',
            });
            chmodSync(join(fixture.path, 'bin/taplo'), 0o755);
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(fixture.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            };
            await install(fixture.path, [...INIT, '--hooks', 'none'], environment);
            const result = run(fixture.path, ['check', 'config-files/toml-format', '--no-cache'], environment);
            expect(result.code, result.stderr + result.stdout).toBe(1);
            expect(result.stdout).toContain('taplo broke:');
            expect(result.stdout).toContain('cannot read the formatting configuration');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'action pin verification reports a rejected commit and preserves the workflow',
        async () => {
            await using fixture = await createFixture({
                'README.md': '# Action pins\n',
                'bin/pinact': PINACT_STUB,
                'bin/pinact.cmd': '@echo off\r\nbun "%~dp0pinact" %*\r\n',
            });
            chmodSync(join(fixture.path, 'bin/pinact'), 0o755);
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(fixture.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            };
            await install(fixture.path, [...INIT, '--hooks', 'none'], environment);
            const path = join(fixture.path, '.github/workflows/broken.yml');
            const workflow = `${WORKFLOW_HEAD}            - uses: actions/checkout@0000000000000000000000000000000000000000\n`;
            await Bun.write(path, workflow);
            const result = run(
                fixture.path,
                ['check', 'config-files/actions-pins', '--at', 'push', '--no-cache'],
                environment,
            );
            expect(result.code, result.stderr + result.stdout).toBe(1);
            expect(result.stdout).toContain('invalid action pin: broken.yml');
            expect(await Bun.file(path).text()).toBe(workflow);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'GitHub initialization writes a workflow accepted by actionlint',
        async () => {
            await using fixture = await createFixture({ 'README.md': '# Workflow test\n' });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['actionlint']) };
            await install(fixture.path, [...INIT, '--ci', 'github', '--hooks', 'none'], environment);
            expect(await Bun.file(join(fixture.path, '.github/workflows/gspot.yml')).exists()).toBe(true);
            const result = Bun.spawnSync(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
                cwd: fixture.path,
                env: { ...environmentVariables(), ...environment },
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(result.exitCode, result.stderr.toString() + result.stdout.toString()).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'each remaining check fires on its planted defect, and the two that others report say so',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' });
            commitAll(fixture.path);
            const environment = {
                PATH: toolsPath(['taplo', 'yamllint', 'actionlint', 'zizmor', 'dotenv-linter', 'typos', 'ec']),
            };
            run(fixture.path, [...INIT, '--hooks', 'none'], environment);
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            expect(run(fixture.path, ['check', 'config-files/json'], environment).stdout).toContain(
                'its findings come from',
            );
            const record = JSON.parse(run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout) as {
                checks: { id: string }[];
            };
            expect(record.checks.map((check) => check.id)).not.toContain('config-files/schema');
            expect(record.checks.map((check) => check.id)).toContain('config-files/toml');
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test.skipIf(process.platform !== 'darwin')(
        'config-files/plist reports a property list that does not parse',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['taplo', 'typos', 'ec']) };
            run(fixture.path, [...INIT, '--hooks', 'none'], environment);
            const outcome = await runPlanted(
                fixture.path,
                {
                    id: 'config-files/plist',
                    files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
                    expected: 'Info.plist',
                },
                environment,
            );
            expect(outcome.code, outcome.stdout).toBe(1);
            expect(outcome.stdout).toContain('Info.plist');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'broken TOML, a duplicated YAML key and a missing environment key are reported',
        async () => {
            await using fixture = await createFixture({
                'scripts/a.sh': script,
                'settings.toml': 'a = 1\n[x\n',
                'config.yaml': 'key: 1\nkey: 2\n',
                '.env.example': 'PORT=3000\n',
            });
            git(fixture.path, ['init', '-q']);
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'init']);
            expect(run(fixture.path, INIT).stdout).toContain('write');
            const environment = { PATH: toolsPath(['taplo', 'yamllint']) };
            const toml = run(fixture.path, ['check', 'config-files/toml'], environment);
            expect(toml.code).toBe(1);
            expect(toml.stdout).toContain('settings.toml:2');
            const yaml = run(fixture.path, ['check', 'config-files/yaml'], environment);
            expect(yaml.code).toBe(1);
            expect(yaml.stdout).toContain('key-duplicates');
            await Bun.write(
                join(fixture.path, 'src', 'server.js'),
                'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n',
            );
            git(fixture.path, ['add', '-A']);
            const keys = run(fixture.path, ['check', 'config-files/env-example', '--at', 'push']);
            expect(keys.code).toBe(1);
            expect(keys.stdout).toContain('HOST');
            expect(keys.stdout).not.toContain('PORT is read');
        },
        PLANTED_TIMEOUT_MS,
    );
});
