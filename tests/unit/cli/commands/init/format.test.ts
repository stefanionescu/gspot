import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { parseTemplate } from '#cli/settings/templates.ts';
import { createReadCache } from '#cli/system/file-reads.ts';
import { readFormatTables } from '#cli/commands/init/format.ts';
import type { SettingsDraft } from '#cli/types/commands/init.ts';
import { initSettingsText } from '#cli/commands/init/settings-text.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { FORMAT_FILE_CASES, SCOPE_FORMAT_CASES, SCOPE_FORMAT_FILES } from '#tests/config/init.ts';

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const draft: SettingsDraft = {
        configurations: ['format'],
        scopes: [],
        hooks: false,
        ci: 'none',
        rules: false,
    };
    const manifests = configurationManifests();
    const formats = readFormatTables(
        draft,
        repository,
        manifests,
        await readDependencyFiles(sandbox.path, repository.files),
    );
    const text = initSettingsText(draft, repository, manifests, formats);
    const session = await openSession(sandbox.path, {
        settings: parseSettings(text),
        text,
    });
    expect(session.scopes[0]!.view.options('format')).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
});

test.each([...SCOPE_FORMAT_CASES])(
    'init reads the format settings of each scope with $name',
    async ({ template, expected }) => {
        await using sandbox = await testdir(SCOPE_FORMAT_FILES);
        const repository = await readRepository(sandbox.path, {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
            reads: createReadCache(sandbox.path),
        });
        const draft: SettingsDraft = {
            configurations: ['format'],
            scopes: ['app', 'app/deep', 'sibling'].map((path) => ({
                name: path,
                path,
                source: 'project',
                configurations: [],
            })),
            hooks: false,
            ci: 'none',
            rules: false,

            ...(template ? { template: parseTemplate(template, 'team.template.toml') } : {}),
        };
        const manifests = configurationManifests();
        const formats = readFormatTables(
            draft,
            repository,
            manifests,
            await readDependencyFiles(sandbox.path, repository.files),
        );
        const text = initSettingsText(draft, repository, manifests, formats);
        const session = await openSession(sandbox.path, {
            settings: parseSettings(text),
            text,
        });
        expect(
            session.scopes.map((scope) => [
                scope.scope.path,
                scope.view.options('format').indent_width,
                scope.view.options('format').print_width,
                scope.view.options('format').quotes,
            ]),
        ).toEqual(expected.map((row) => [...row]));
        for (const [path, source] of Object.entries(SCOPE_FORMAT_FILES))
            expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);
