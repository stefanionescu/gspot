import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { prepare } from '#cli/commands/init/prepare.ts';
import { parseTemplate } from '#cli/policy/templates.ts';
import { writeSetup } from '#cli/commands/init/write.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { SYNCPACK_TAKEOVERS } from '#tests/config/tools/generation/takeover.ts';

test.each(SYNCPACK_TAKEOVERS)(
    'initialization retires native Syncpack configuration $file',
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
        const before = await runTestCommand(['syncpack', 'lint', '--no-ansi'], { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const options = buildInitOptions(sandbox.path, {
            configurations: ['none'],
            template: parseTemplate('template = "coverage"\nselection = "detect"\nlevel = "all"\n', 'level.toml'),
        });
        const prepared = await prepare(sandbox.path, options);
        expect(prepared.plan.remove).toContainEqual({
            path: file,
            note: 'replaced by the generated syncpack configuration',
        });
        expect(
            prepared.plan.remove.some((entry) => ['syncpack.config.cts', 'syncpack.config.mts'].includes(entry.path)),
        ).toBe(false);
        const initialized = await writeSetup(sandbox.path, options, prepared);
        expect(initialized.exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.cts')).text()).toBe('module.exports = {};\n');
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.mts')).text()).toBe('export default {};\n');
        const command = ['syncpack', 'lint', '--config', '.gspot/config/syncpack.json', '--no-ansi'];
        const after = await runTestCommand(command, { cwd: sandbox.path });
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stderr).toContain('fixture');
        expect(after.stderr).toContain('SameRangeMismatch');
        await Bun.write(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
