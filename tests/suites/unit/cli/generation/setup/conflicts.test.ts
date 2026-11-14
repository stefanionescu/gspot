import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { planSandboxInit, applySandboxInit } from '#tests/setup/cli/commands.ts';
import { GOOGLE_PYPROJECT, CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { stat, chmod, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

import {
    INVALID_CSS,
    SHARED_SETUP_CONFIG,
    REPLACED_CONFIG_DELETIONS,
    REPLACED_PYPROJECT_TABLES,
    STYLELINT_REPLACEMENT_CASES,
} from '#tests/config/generation/setup.ts';

async function assertFileKept(root: string, path: string, previous: string): Promise<void> {
    expect(await readFile(join(root, path), 'utf8')).toBe(previous);
    const attributes = await stat(join(root, path));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
}

test('init deletes the config files that the selected configurations replace', async () => {
    await using sandbox = await testdir({
        'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
        '.shellcheckrc': 'disable=SC2086,SC2034\n',
        '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
        '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
        '.prettierrc': '{ "semi": false }\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'src/a.js': 'export const a = 1;\n',
        'README.md': '# test\n',
        'quality/lint.sh': CLEAN_BASH_SCRIPT,
    });
    const names = ['bash', 'javascript', 'spelling', 'markdown'];
    const { plan } = await applySandboxInit(
        sandbox.path,
        names.flatMap((name) => ['--configurations', name]),
    );
    expect(plan.deleted.map(({ path }) => path)).toStrictEqual(REPLACED_CONFIG_DELETIONS.map(({ path }) => path));
    for (const { path } of REPLACED_CONFIG_DELETIONS) expect(existsSync(join(sandbox.path, path))).toBe(false);
});

test('init deletes the ignore file of a replaced tool in a nested package and carries no ignore from it', async () => {
    await using sandbox = await testdir({
        'README.md': '# test\n',
        'db/accounts.sql': 'SELECT 1;\n',
        'db/package.json': '{"private":true}',
        'db/.sqlfluffignore': '# Templates\ntemplates/\n',
    });
    const { plan, settings } = await planSandboxInit(sandbox.path);
    expect(plan.deleted.map(({ path }) => path)).toContain('db/.sqlfluffignore');
    expect(settings['ignore']).toBeUndefined();
});

test('init keeps a linked shared file and the bytes and mode of the file it links to', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'settings/shared.cfg': SHARED_SETUP_CONFIG, 'query.sql': 'SELECT 1;\n' });
    const target = join(sandbox.path, 'settings/shared.cfg');
    await chmod(target, 0o640);
    await symlink('settings/shared.cfg', join(sandbox.path, 'setup.cfg'));
    const { plan } = await applySandboxInit(sandbox.path, ['--configurations', 'sql']);
    expect(plan.keep).toStrictEqual([{ path: 'setup.cfg', note: expect.stringContaining('sqlfluff') as string }]);
    expect(plan.deleted.map(({ path }) => path)).not.toContain('setup.cfg');
    expect(await readlink(join(sandbox.path, 'setup.cfg'))).toBe(join('settings', 'shared.cfg'));
    expect(await readFile(target, 'utf8')).toBe(SHARED_SETUP_CONFIG);
    const attributes = await stat(target);
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    const generated = join(sandbox.path, getManifestTarget('sql', 'sqlfluff.cfg'));
    expect(existsSync(generated)).toBe(true);
});

test.each([...REPLACED_PYPROJECT_TABLES])(
    'init names the $table table it leaves in pyproject.toml',
    async ({ configuration, table, text, source, generated }) => {
        await using sandbox = await createGitSandbox({});
        const path = 'pyproject.toml';
        const previous = `${GOOGLE_PYPROJECT}[tool.unrelated]\nkeep = true\n\n${text}`;
        await createFileTree(sandbox.path, {
            [path]: previous,
            [source.file]: source.text,
        });
        await chmod(join(sandbox.path, path), 0o640);
        const { plan } = await applySandboxInit(sandbox.path, ['--configurations', configuration]);
        expect(plan.keep).toStrictEqual([{ path, note: expect.stringContaining(table) as string }]);
        await assertFileKept(sandbox.path, path, previous);
        expect(existsSync(join(sandbox.path, generated))).toBe(true);
    },
);

test('at level basic, init keeps the config files of checks that are off', async () => {
    await using sandbox = await testdir({
        '.commitlintrc.json': '{"rules":{}}\n',
        '.commitlintrc.mts': 'export default { rules: {} };\n',
        '.syncpackrc.json': '{"versionGroups":[]}\n',
        '.syncpackrc.yaml': 'versionGroups: []\n',
        'package.json':
            '{"name":"native-project","private":true,"commitlint":{"rules":{"type-enum":[2,"always",["special"]]}},"kept":[0,false,""]}\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'gspot', '--level', 'basic']);
    expect(plan.deleted).toStrictEqual([]);
    expect(plan.change.map(({ path }) => path)).toStrictEqual(['package.json']);
    expect(plan.write.map(({ path }) => path).filter((path) => /commitlint|syncpack/u.test(path))).toStrictEqual([]);
});

test.each([...STYLELINT_REPLACEMENT_CASES])(
    'init replaces your .stylelintrc.mjs so that Stylelint still finds its settings: $name',
    async ({ scope, packageText, initArguments, changed, unchangedFiles }) => {
        const packagePath = posix.join(scope, 'package.json');
        const stylesheet = posix.join(scope, 'source.css');
        const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
        await using sandbox = await testdir({
            '.gitignore': `${GSPOT_FOLDER}/\n`,
            [packagePath]: packageText,
            [stylesheet]: INVALID_CSS,
            [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
        });
        await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
        const command = buildProgramCommand('checks/stylelint', stylesheet);
        const before = await runCommand(command, { cwd: sandbox.path });
        expect(before, before.stderr).toMatchObject({ code: 0, stdout: '[]' });
        const { plan } = await applySandboxInit(sandbox.path, initArguments);
        expect(plan.deleted).toContainEqual({
            path: authoredConfiguration,
            note: expect.stringContaining('stylelint') as string,
        });
        expect(
            plan.change
                .filter(({ path, note }) => path === packagePath && note.includes('stylelint'))
                .map(({ path }) => path),
        ).toStrictEqual([...changed]);
        expect(plan.keep).toStrictEqual([]);
        expect(existsSync(join(sandbox.path, authoredConfiguration))).toBe(false);
        for (const { path, text } of unchangedFiles) {
            const saved = await readFile(join(sandbox.path, path), 'utf8');
            expect(JSON.parse(saved)).toMatchObject(JSON.parse(text) as object);
        }
        const invalid = await runCommand(command, { cwd: sandbox.path });
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(0);
        expect(invalid.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
        await writeFile(join(sandbox.path, stylesheet), 'a {\n    opacity: 1;\n}\n');
        const corrected = await runCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe('[]');
    },
);

test('init keeps an authored CLAUDE.md byte for byte', async () => {
    const authored = '# Claude notes\r\n\r\nRun the tests.  \n';
    await using sandbox = await createGitSandbox({ 'CLAUDE.md': authored, 'AGENTS.md': '# Team notes\n' });
    await applySandboxInit(sandbox.path);
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe(authored);
});

test('init refuses to replace a config file when Git cannot read the committed history', async () => {
    await using sandbox = await createGitSandbox({ '.prettierrc.json': '{}\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    const historyError = await captureRejection(assertFilesCommitted(sandbox.path, ['.prettierrc.json']));
    expect(historyError).toMatchObject({ name: 'GspotError', code: 'git' });
});
