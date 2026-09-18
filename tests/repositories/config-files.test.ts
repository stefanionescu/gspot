// The config-files preset: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { git, toolsPath, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

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

describe('the config-files preset', () => {
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
