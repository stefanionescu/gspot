// Takeover at init: owned configuration files are replaced, their exception lists carried into gspot.toml with a reason, and the lint folder listed for deletion.
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { treeContents } from '#tests/harness/contents.ts';
import { git, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'bash',
    'javascript',
    'spelling',
    'markdown',
    '--runner',
    'none',
    '--ci',
    'none',
    '--no-rules',
    '--no-install',
];

describe('takeover', () => {
    test.each(['', 'hooks', '.husky'])(
        'dry-run distinguishes source hooks from configured hooks at %s',
        async (hooksPath) => {
            await using sandbox = await createSandbox({
                'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
                ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
            });
            expect(runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
            if (hooksPath !== '')
                expect(runBlocking(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path }).code).toBe(0);
            const result = await run(sandbox.path, [...INIT, '--dry-run']);
            expect(result.code).toBe(0);
            const hooks = result.stdout.split('\n').find((line) => /^hooks\s/.test(line));
            if (hooksPath === '') expect(hooks).toMatch(/^hooks\s+none$/);
            else {
                expect(hooks).toContain(`${hooksPath}/`);
                expect(hooks).toContain('pre-commit');
                expect(hooks?.split('(hand-written)')).toHaveLength(2);
            }
            expect(readFileSync(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.each([
        ['typos.toml', '[default\n'],
        ['.markdownlint.jsonc', '{ "MD013": false, broken }\n'],
        ['eslint.config.mjs', "export default [{ rules: { 'no-console': 'off' } }];\n"],
    ])(
        'unreadable or unsupported %s preserves every original file and mode',
        async (path, text) => {
            await using sandbox = await createSandbox({
                [path]: text,
                'notes.md': '# Notes\n',
            });
            const before = treeContents(sandbox.path);
            const preview = await run(sandbox.path, [...INIT, '--hooks', 'none', '--dry-run']);
            expect(preview.code, preview.stdout + preview.stderr).toBe(0);
            expect(preview.stdout).toContain('not read and not deleted');
            expect(treeContents(sandbox.path)).toEqual(before);
            const result = await run(sandbox.path, [...INIT, '--hooks', 'none']);
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stdout).toContain('Cannot apply takeover');
            expect(treeContents(sandbox.path)).toEqual(before);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'replaces owned files, carries their exception lists with a reason, and lists the lint folder',
        async () => {
            await using sandbox = await createSandbox({
                'scripts/a.sh': script,
                'src/a.js': 'export const a = 1;\n',
                'README.md': '# planted\n',
                'typos.toml':
                    '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\ncertifi = "certifi"\n',
                '.shellcheckrc': 'disable=SC2086,SC2034\n',
                '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
                'quality/lint.sh': script,
            });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            const init = await run(sandbox.path, INIT, { PATH: toolsPath(['ast-grep']) });
            expect(init.stdout).toContain('carried into gspot.toml');
            expect(init.stdout).toContain('quality/');
            const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
            expect(policy).toContain('The device identifier API name.');
            expect(policy).toContain('carried from typos.toml at init');
            // The old file named no locale, which accepts every English dialect, so the repository keeps that.
            expect(policy).toContain('locale = "en"');
            expect(readFileSync(join(sandbox.path, '.gspot/typos.toml'), 'utf8')).toContain('locale = "en"');
            expect(policy).toContain('SC2086');
            expect(policy).toContain('carried from .shellcheckrc at init');
            expect(policy).toContain('MD013');
            expect(policy).not.toContain('MD033');
            for (const stub of ['typos.toml', '.shellcheckrc', '.markdownlint-cli2.jsonc'])
                expect(readFileSync(join(sandbox.path, stub), 'utf8')).toContain('gspot');
            const eslintStub = ['eslint.config.js', 'eslint.config.mjs'].find((name) =>
                existsSync(join(sandbox.path, name)),
            );
            expect(eslintStub).toBeDefined();
            expect(readFileSync(join(sandbox.path, eslintStub ?? ''), 'utf8')).toContain('gspot');
            expect(existsSync(join(sandbox.path, '.markdownlint.jsonc'))).toBe(false);
            expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
            const applied = await run(sandbox.path, ['apply', '--check']);
            expect(applied.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
