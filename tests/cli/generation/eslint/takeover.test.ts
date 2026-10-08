import { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { join, posix, relative } from 'node:path';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { toPosix } from '#cli/platform/contracts.ts';
import { prepare } from '#cli/commands/init/public.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { writeSetup } from '#cli/commands/init/contracts.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { VALID_CSS, INVALID_CSS, TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';
import { KNIP_TAKEOVERS, STYLELINT_DISCOVERY } from '#tests/config/cli/generation/eslint/takeover.ts';

test.each(['', 'app'])('native Stylelint discovery uses owned package fields at both levels in %s', async (scope) => {
    await using sandbox = await testdir();
    const packagePath = posix.join(scope, 'package.json');
    const stylesheet = posix.join(scope, 'source.css');
    const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\n',
        [packagePath]: TAKEOVER_PACKAGE,
        [stylesheet]: INVALID_CSS,
        [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
    });
    commitAll(sandbox.path);
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const command = ['node', '--input-type=module', '-e', STYLELINT_DISCOVERY, stylesheet];
    const before = await runTestCommand(command, { cwd: sandbox.path });
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stdout).toBe('[]');
    const options = buildInitOptions(
        sandbox.path,
        scope === '' ? { configurations: ['css'] } : { configurations: ['none'], scopes: new Map([['app', ['css']]]) },
    );
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.remove).toContainEqual({
        path: authoredConfiguration,
        note: 'replaced by the generated stylelint configuration',
    });
    expect(prepared.plan.change).toContainEqual({
        path: packagePath,
        note: 'managed stylelint fields; other content stays',
    });
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    expect(await Bun.file(join(sandbox.path, authoredConfiguration)).exists()).toBe(false);
    for (const level of ['recommended', 'all']) {
        const changed = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        await Bun.write(join(sandbox.path, stylesheet), INVALID_CSS);
        const native = await runTestCommand(command, { cwd: sandbox.path });
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(native.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
        await Bun.write(join(sandbox.path, stylesheet), VALID_CSS);
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe('[]');
    }
});

test('native Stylelint discovery retires a standalone module configuration without adding a package field', async () => {
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
    const command = ['node', '--input-type=module', '-e', STYLELINT_DISCOVERY, 'source.css'];
    const before = await runTestCommand(command, { cwd: sandbox.path });
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stdout).toBe('[]');
    const options = buildInitOptions(sandbox.path, { configurations: ['css'] });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.remove).toContainEqual({
        path: '.stylelintrc.mjs',
        note: 'replaced by the generated stylelint configuration',
    });
    expect(prepared.plan.change.some((entry) => entry.path === 'package.json')).toBe(false);
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.stylelintrc.mjs')).exists()).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(authored);
    const after = await runTestCommand(command, { cwd: sandbox.path });
    expect(after.code, after.stdout + after.stderr).toBe(0);
    expect(after.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
    await Bun.write(join(sandbox.path, 'source.css'), VALID_CSS);
    const corrected = await runTestCommand(command, { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.stdout).toBe('[]');
});

test.each(['eslint.config.mts', 'eslint.config.cts'])(
    'initialization retires the native ESLint configuration %s',
    async (file) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': '.gspot/\n',
            'package.json': '{"private":true,"type":"module"}',
            [file]: 'export default [];\n',
            'main.js': 'export const value = 1;\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const before = await new ESLint({ cwd: sandbox.path }).findConfigFile('main.js');
        expect(toPosix(relative(sandbox.path, before!))).toBe(file);
        const options = buildInitOptions(sandbox.path, { configurations: ['javascript'] });
        const prepared = await prepare(sandbox.path, options);
        expect(prepared.plan.remove).toContainEqual({
            path: file,
            note: 'replaced by the generated eslint configuration',
        });
        const initialized = await writeSetup(sandbox.path, options, prepared);
        expect(initialized.exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        const after = await new ESLint({ cwd: sandbox.path }).findConfigFile('main.js');
        expect(toPosix(relative(sandbox.path, after!))).toBe('eslint.config.mjs');
    },
);

test.each(KNIP_TAKEOVERS)(
    'initialization retires native Knip configuration $file and preserves unsupported names',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': '.gspot/\n',
            'package.json': '{"private":true,"type":"module"}',
            [file]: source,
            'knip.config.mjs': 'export default {};\n',
            'main.js': 'export const value = 1;\n',
            'unused.js': 'export const unused = 2;\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [
            'node',
            '.gspot/node_modules/knip/bin/knip.js',
            '--no-progress',
            '--reporter',
            'json',
            '--include',
            'files',
        ];
        const before = await runTestCommand(command, { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(1);
        expect(JSON.parse(before.stdout)).toMatchObject({
            issues: [{ file: 'unused.js', files: [{ name: 'unused.js' }] }],
        });
        const options = buildInitOptions(sandbox.path, { configurations: ['javascript'] });
        const prepared = await prepare(sandbox.path, options);
        expect(prepared.plan.remove).toContainEqual({
            path: file,
            note: 'replaced by the generated knip configuration',
        });
        expect(prepared.plan.remove.some((entry) => entry.path === 'knip.config.mjs')).toBe(false);
        const initialized = await writeSetup(sandbox.path, options, prepared);
        expect(initialized.exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'knip.config.mjs')).text()).toBe('export default {};\n');
        const after = await runTestCommand([...command, '--config', '.gspot/config/knip.json'], { cwd: sandbox.path });
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(JSON.parse(after.stdout)).toMatchObject({
            issues: [
                { file: 'knip.config.mjs', files: [{ name: 'knip.config.mjs' }] },
                { file: 'main.js', files: [{ name: 'main.js' }] },
                { file: 'unused.js', files: [{ name: 'unused.js' }] },
            ],
        });
        const changed = await runGspot(sandbox.path, [
            'set',
            'tools.knip.entry',
            '["main.js","unused.js","knip.config.mjs"]',
        ]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const corrected = await runTestCommand([...command, '--config', '.gspot/config/knip.json'], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toMatchObject({ issues: [] });
    },
);
