import * as fs from 'node:fs';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a staged Astro build resolves linked packages and builds HTML inside its disposable copy', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: '[site]\nbuild_command = ["astro", "build"]\n',
        }),
        'package.json': JSON.stringify({
            private: true,
            type: 'module',
            dependencies: { astro: SANDBOX_PACKAGES.astro, semver: '0.0.0-test' },
        }),
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
        'src/pages/index.astro':
            '---\nimport semver from "semver";\nconst matches = semver.satisfies("1.2.3", "^1.0.0");\n---\n<html lang="en"><head><title>Copy build</title></head><body><p>{String(matches)}</p></body></html>\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    runGitStep(sandbox.path, ['add', '--all']);
    const built: string[] = [];
    const remove = fs.rmSync;
    using _cleanup = spyOn(fs, 'rmSync').mockImplementation((path, options) => {
        if (typeof path === 'string') {
            const output = join(path, 'dist/index.html');
            if (fs.existsSync(output)) built.push(fs.readFileSync(output, 'utf8'));
        }
        remove(path, options);
    });
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'site/build', '--json']),
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'passed' }]);
    expect(built).toHaveLength(1);
    expect(built[0]).toContain('<p>true</p>');
    expect(fs.existsSync(join(sandbox.path, 'dist'))).toBe(false);
    expect(fs.existsSync(join(sandbox.path, '.gspot-copies'))).toBe(false);
});
