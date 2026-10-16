import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { SYNCPACK_FILES } from '#tests/data/checks/dependencies.ts';

test.each([...SYNCPACK_FILES])(
    'init replaces your Syncpack file $file and keeps syncpack.config.cts and .mts',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
        await createFileTree(sandbox.path, {
            [file]: source,
            'gspot.template.toml': buildSettingsText([], { level: 'all' }),
            'package.json': rootPackage,
            'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        const execution = { cwd: sandbox.path, env: { PATH: buildSandboxPath() } };
        const before = await runCommand(['syncpack', 'lint', '--no-ansi'], execution);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const initialized = await spawnGspot(
            sandbox.path,
            [...buildInitArguments([]), '--no-configurations', '--from', 'gspot.template.toml'],
            execution.env,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.cts')).text()).toBe('module.exports = {};\n');
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.mts')).text()).toBe('export default {};\n');
        const command = ['syncpack', 'lint', '--config', '.gspot/config/syncpack.json', '--no-ansi'];
        const after = await runCommand(command, execution);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stderr).toContain('fixture');
        expect(after.stderr).toContain('SameRangeMismatch');
        await Bun.write(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
        const corrected = await runCommand(command, execution);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
