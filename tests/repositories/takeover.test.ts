// Takeover at init: owned configuration files are replaced, their exception lists carried into gspot.toml with a reason, and the lint folder listed for deletion.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { git, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'bash,javascript,spelling,markdown',
    '--runner',
    'none',
    '--ci',
    'none',
    '--no-rules',
    '--no-install',
];

describe('takeover', () => {
    test(
        'replaces owned files, carries their exception lists with a reason, and lists the lint folder',
        async () => {
            await using fixture = await createFixture({
                'scripts/a.sh': script,
                'src/a.js': 'export const a = 1;\n',
                'README.md': '# planted\n',
                'typos.toml':
                    '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\ncertifi = "certifi"\n',
                '.shellcheckrc': 'disable=SC2086,SC2034\n',
                'eslint.config.mjs':
                    "export default [\n    {\n        rules: {\n            'no-console': 'off',\n            'no-var': 'error',\n        },\n    },\n];\n",
                '.markdownlint.jsonc': '{ "MD013": false, "MD033": true }\n',
                'quality/lint.sh': script,
            });
            git(fixture.path, ['init', '-q']);
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'init']);
            const init = run(fixture.path, INIT, { PATH: toolsPath(['ast-grep']) });
            expect(init.stdout).toContain('carried into gspot.toml');
            expect(init.stdout).toContain('quality/');
            const policy = readFileSync(join(fixture.path, 'gspot.toml'), 'utf8');
            expect(policy).toContain('The device identifier API name.');
            expect(policy).toContain('carried from typos.toml at init');
            // The old file named no locale, which accepts every English dialect, so the repository keeps that.
            expect(policy).toContain('locale = "en"');
            expect(readFileSync(join(fixture.path, '.gspot/typos.toml'), 'utf8')).toContain('locale = "en"');
            expect(policy).toContain('SC2086');
            expect(policy).toContain('carried from .shellcheckrc at init');
            expect(policy).toContain('no-console');
            expect(policy).not.toContain('no-var');
            expect(policy).toContain('carried from eslint.config.mjs at init');
            expect(policy).toContain('MD013');
            expect(policy).not.toContain('MD033');
            for (const stub of ['typos.toml', '.shellcheckrc', '.markdownlint-cli2.jsonc'])
                expect(readFileSync(join(fixture.path, stub), 'utf8')).toContain('gspot');
            const eslintStub = ['eslint.config.js', 'eslint.config.mjs'].find((name) =>
                existsSync(join(fixture.path, name)),
            );
            expect(eslintStub).toBeDefined();
            expect(readFileSync(join(fixture.path, eslintStub ?? ''), 'utf8')).toContain('gspot');
            expect(readFileSync(join(fixture.path, eslintStub ?? ''), 'utf8')).not.toContain('no-var');
            expect(existsSync(join(fixture.path, '.markdownlint.jsonc'))).toBe(false);
            expect(existsSync(join(fixture.path, 'quality', 'lint.sh'))).toBe(true);
            expect(run(fixture.path, ['apply', '--check']).code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
