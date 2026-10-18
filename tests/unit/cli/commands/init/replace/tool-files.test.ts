import { join, posix } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/processes.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { STYLELINT_LOOKUP_SCRIPT } from '#tests/data/commands/init.ts';
import { runGspot, runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { VALID_CSS, INVALID_CSS, STYLELINT_PACKAGE_JSON } from '#tests/data/checks/css.ts';

test.each(['', 'app'])(
    "init replaces your .stylelintrc.mjs with a package.json field that Stylelint finds, in scope '%s'",
    async (scope) => {
        using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

        await using sandbox = await testdir();
        const packagePath = posix.join(scope, 'package.json');
        const stylesheet = posix.join(scope, 'source.css');
        const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
        await createFileTree(sandbox.path, {
            '.gitignore': '.gspot/\n',
            [packagePath]: STYLELINT_PACKAGE_JSON,
            [stylesheet]: INVALID_CSS,
            [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
            'template.toml': 'configurations = []\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [process.execPath, '-e', STYLELINT_LOOKUP_SCRIPT, stylesheet];
        const before = await runCommand(command, { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        expect(before.stdout).toBe('[]');
        const initCommand =
            scope === '' ? ['init', '--yes', '--configurations', 'css'] : ['init', '--yes', '--from', 'template.toml'];
        const preview = await runRegisteredCommand(sandbox.path, [...initCommand, '--dry-run']);
        expect((preview.json as InitJson).plan!.delete).toContainEqual({
            path: authoredConfiguration,
            note: 'replaced by the generated stylelint tool file',
        });
        expect((preview.json as InitJson).plan!.change).toContainEqual({
            path: packagePath,
            note: 'managed stylelint fields; other content stays',
        });
        const written = await runRegisteredCommand(sandbox.path, initCommand);
        expect(written.exitCode, written.text).toBe(0);
        expect(await Bun.file(join(sandbox.path, authoredConfiguration)).exists()).toBe(false);
        for (const level of LEVELS) {
            const changed = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
            await Bun.write(join(sandbox.path, stylesheet), INVALID_CSS);
            const native = await runCommand(command, { cwd: sandbox.path });
            expect(native.code, native.stdout + native.stderr).toBe(0);
            expect(native.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
            await Bun.write(join(sandbox.path, stylesheet), VALID_CSS);
            const corrected = await runCommand(command, { cwd: sandbox.path });
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(corrected.stdout).toBe('[]');
        }
    },
);

test('init replaces a standalone .stylelintrc.mjs without adding a package.json field', async () => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    await using sandbox = await testdir();
    const authored = '{"private":true,"type":"module"}';
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\n',
        'package.json': authored,
        'source.css': INVALID_CSS,
        '.stylelintrc.mjs': 'export default { rules: { "property-no-unknown": null } };\n',
    });
    commitAll(sandbox.path);
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const command = [process.execPath, '-e', STYLELINT_LOOKUP_SCRIPT, 'source.css'];
    const before = await runCommand(command, { cwd: sandbox.path });
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stdout).toBe('[]');
    const initCommand = ['init', '--yes', '--configurations', 'css'];
    const preview = await runRegisteredCommand(sandbox.path, [...initCommand, '--dry-run']);
    const plan = (preview.json as InitJson).plan!;
    expect(plan.delete).toContainEqual({
        path: '.stylelintrc.mjs',
        note: 'replaced by the generated stylelint tool file',
    });
    expect(plan.change.some((entry) => entry.path === 'package.json')).toBe(false);
    const written = await runRegisteredCommand(sandbox.path, initCommand);
    expect(written.exitCode, written.text).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.stylelintrc.mjs')).exists()).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(authored);
    const after = await runCommand(command, { cwd: sandbox.path });
    expect(after.code, after.stdout + after.stderr).toBe(0);
    expect(after.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
    await Bun.write(join(sandbox.path, 'source.css'), VALID_CSS);
    const corrected = await runCommand(command, { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.stdout).toBe('[]');
});
