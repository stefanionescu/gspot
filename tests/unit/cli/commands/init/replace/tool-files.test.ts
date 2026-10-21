import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { InitJson } from '#cli/types/commands/init.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { VALID_CSS, INVALID_CSS } from '#tests/data/checks/css.ts';
import { STYLELINT_LOOKUP_SCRIPT, STYLELINT_REPLACEMENT_CASES } from '#tests/data/commands/init.ts';

test.each([...STYLELINT_REPLACEMENT_CASES])(
    'init replaces your .stylelintrc.mjs so that Stylelint still finds its settings at both levels: $name',
    async ({ scope, packageText, command: initCommand, changed, unchangedFiles }) => {
        const packagePath = posix.join(scope, 'package.json');
        const stylesheet = posix.join(scope, 'source.css');
        const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
        await using sandbox = await testdir({
            '.gitignore': '.gspot/\n',
            [packagePath]: packageText,
            [stylesheet]: INVALID_CSS,
            [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [process.execPath, '-e', STYLELINT_LOOKUP_SCRIPT, stylesheet];
        const before = await runCommand(command, { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        expect(before.stdout).toBe('[]');
        const preview = await runGspot(sandbox.path, [...initCommand, '--dry-run', '--json']);
        const plan = (JSON.parse(preview.stdout) as InitJson).plan;
        expect(plan.delete).toContainEqual({
            path: authoredConfiguration,
            note: 'replaced by the generated stylelint tool file',
        });
        expect(plan.change.filter(({ path }) => path === packagePath)).toStrictEqual(
            changed.map((path) => ({ path, note: 'managed stylelint fields; other content stays' })),
        );
        const written = await runGspot(sandbox.path, initCommand);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, authoredConfiguration))).toBe(false);
        for (const { path, text } of unchangedFiles)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
        for (const level of LEVELS) {
            const selected = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await writeFile(join(sandbox.path, stylesheet), INVALID_CSS);
            const invalid = await runCommand(command, { cwd: sandbox.path });
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(0);
            expect(invalid.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
            await writeFile(join(sandbox.path, stylesheet), VALID_CSS);
            const corrected = await runCommand(command, { cwd: sandbox.path });
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(corrected.stdout).toBe('[]');
        }
    },
);
