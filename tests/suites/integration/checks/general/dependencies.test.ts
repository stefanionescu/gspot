import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { spawnGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { SYNCPACK_FILES } from '#tests/config/integration/checks/general/dependencies.ts';

test.each([...SYNCPACK_FILES])(
    'init replaces your Syncpack file $file and keeps syncpack.config.cts and .mts',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
        await createFileTree(sandbox.path, {
            [file]: source,
            'package.json': rootPackage,
            'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        const execution = { cwd: sandbox.path, env: {} };
        const before = await runCommand(['syncpack', 'lint', '--no-ansi'], execution);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const initialized = await spawnGspot(
            sandbox.path,
            [...buildInitArguments([]), '--no-configurations', '--level', 'all'],
            execution.env,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, file))).toBe(false);
        expect(await readFile(join(sandbox.path, 'syncpack.config.cts'), 'utf8')).toBe('module.exports = {};\n');
        expect(await readFile(join(sandbox.path, 'syncpack.config.mts'), 'utf8')).toBe('export default {};\n');
        const command = [
            'syncpack',
            'lint',
            '--config',
            '.gspot/configurations/general/dependencies/syncpack.json',
            '--no-ansi',
        ];
        const after = await runCommand(command, execution);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stderr).toContain('fixture');
        expect(after.stderr).toContain('SameRangeMismatch');
        await writeFile(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
        const corrected = await runCommand(command, execution);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
