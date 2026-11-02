import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/tools/versions.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { findPackagePin, findMissingBuild, listNpmProjectPins } from '#cli/tools/pins.ts';

test.each([...TOOL_PROJECT_PACKAGES])('$name: the installers give the expected tool project package', (row) => {
    const tool = { ...buildProgramPin(row.tool, row.version), system: row.system, installers: row.installers };
    const placement = findPackagePin(tool);
    expect(placement).toStrictEqual(row.expected);
});

test('missing tool builds name the operating system and allow unrestricted tools', () => {
    const tool = buildProgramPin('example', '0.0.0-test');
    const host = { platform: 'macos', arch: 'arm64' } as const;
    expect(findMissingBuild({ ...tool, builds: ['linux'] }, host)).toBe('macOS');
    expect(findMissingBuild(tool, host)).toBeUndefined();
});

test('two plugin records that name one package at two versions are refused', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], {
            tables: '[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "1.0.0"\nrules = {}\n[[scope]]\npath = "app"\nconfigurations = []\n[[scope.tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "2.0.0"\nrules = {}\n',
        }),
        'app/a.css': 'a { color: red; }\n',
    });
    const session = await openSession(sandbox.path);
    expect(() => listNpmProjectPins(session)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: 'The plugin records name stylelint-acme at two versions. Use one version.',
        }),
    );
});
