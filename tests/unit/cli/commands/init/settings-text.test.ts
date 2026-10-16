import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { parseTemplate } from '#cli/settings/templates.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { EMPTY_EXISTING_TOOLS } from '#tests/config/tooling.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/xcode.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { proposeCi, initSettingsText } from '#cli/commands/init/settings-text.ts';

import {
    LINT_JOBS,
    SDK_DESTINATIONS,
    CI_PREFERENCE_CASES,
    INIT_CONFIGURATIONS,
    TEMPLATE_SWIFT_CHOICES,
} from '#tests/config/init.ts';

test.each([...CI_PREFERENCE_CASES])(
    'init proposes the CI provider from %s',
    async (_label, ci, path, remote, expected) => {
        await using sandbox = await testdir();
        if (path !== '') await createFileTree(sandbox.path, { [path]: '{}\n' });
        gitOutput(sandbox.path, ['init', '-q']);
        gitOutput(sandbox.path, ['config', 'remote.origin.url', remote]);
        expect(
            proposeCi(sandbox.path, {
                ...EMPTY_EXISTING_TOOLS,
                toolFiles: [...EMPTY_EXISTING_TOOLS.toolFiles],
                hooks: [...EMPTY_EXISTING_TOOLS.hooks],
                agentFiles: [...EMPTY_EXISTING_TOOLS.agentFiles],
                rulesDirectories: [...EMPTY_EXISTING_TOOLS.rulesDirectories],
                lintFolders: [...EMPTY_EXISTING_TOOLS.lintFolders],
                lintOnlyManifests: [...EMPTY_EXISTING_TOOLS.lintOnlyManifests],
                ci: [...ci],
            }),
        ).toBe(expected);
    },
);

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const text = initSettingsText(
        {
            configurations: [...INIT_CONFIGURATIONS],
            scopes: [
                {
                    source: 'project',
                    path: 'apps/site',
                    configurations: INIT_CONFIGURATIONS.slice(0, 12),
                },
            ],
            hooks: true,
            ci: 'none',
            rules: true,
        },
        repository,
        readManifests(),
        new Map(),
    );
    expect(text).toContain('configurations = ["typescript",');
    const settings = parseSettings(text);
    expect(settings.configurations).toStrictEqual([...INIT_CONFIGURATIONS]);
    expect(settings.scope['apps/site']?.configurations).toStrictEqual(INIT_CONFIGURATIONS.slice(0, 12));
    expect(emitSettings(text, parseTomlText(text, 'gspot.toml', 'settings'))).toBe(text);
});

test('template settings stay beside the commit scopes init adds', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const text = initSettingsText(
        {
            configurations: ['python'],
            scopes: [],
            template: parseTemplate(
                stringify({
                    tools: { commitlint: { types: ['feat'], scopes: ['root'] } },
                    architecture: { roles: { environment_readers: ['tests/env.sh'] } },
                }),
                'team.template.toml',
            ),
            commitScopes: ['api'],
            hooks: false,
            ci: 'none',
            rules: false,
        },
        repository,
        readManifests(),
        new Map(),
    );
    expect(parse(text)).toMatchObject({
        tools: { commitlint: { types: ['feat'], scopes: ['api'] } },
        architecture: { roles: { environment_readers: ['tests/env.sh'] } },
    });
});

test('initialization honors disabled integrations and preserves template format settings', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const text = initSettingsText(
        {
            configurations: ['format'],
            scopes: [],
            template: parseTemplate(
                stringify({
                    hooks: { enabled: true },
                    ci: { provider: 'github' },

                    format: { indent_width: 2 },
                }),
                'format.template.toml',
            ),
            hooks: false,
            ci: 'none',
            rules: false,
        },
        repository,
        readManifests(),
        new Map(),
    );
    const document = parse(text);
    expect(document).toMatchObject({
        format: { indent_width: 2 },
        rules: { enabled: false },
    });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});

test('a template keeps its comments and gspot.toml records which template it copied', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const template = parseTemplate(
        `# Rule owner
[rules]
instruction_files = ["TEAM.md"]
`,
        'team.template.toml',
    );
    const text = initSettingsText(
        {
            configurations: [],
            scopes: [],
            template,
            hooks: false,
            ci: 'none',
            rules: true,
        },
        repository,
        readManifests(),
        new Map(),
    );
    expect(text).toContain(`# Copied from template team.template.toml, sha256 ${template.digest}.`);
    expect(text).toContain('# Rule owner\n[rules]');
    expect(parse(text)).toMatchObject({ rules: { instruction_files: ['TEAM.md'] } });
    expect(parseSettings(text).rules.enabled).toBe(true);
    expect(emitSettings(text, parseTomlText(text, 'gspot.toml', 'settings'))).toBe(text);
});

test.each([...SDK_DESTINATIONS])('init picks the Xcode destination for SDK $sdk', async ({ sdk, destination }) => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', `SDKROOT=${sdk}`);
    await using sandbox = await testdir({ 'App.xcodeproj/project.pbxproj': source });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const text = initSettingsText(
        { configurations: ['swift', 'xcode'], scopes: [], hooks: false, ci: 'none', rules: false },
        repository,
        readManifests(),
        new Map(),
    );
    const session = await openSession(sandbox.path, {
        settings: parseSettings(text),
        text,
    });
    expect(session.scopes[0]!.view.options('xcode').destination).toBe(destination);
    expect(await Bun.file(`${sandbox.path}/App.xcodeproj/project.pbxproj`).text()).toBe(source);
});

test.each([...TEMPLATE_SWIFT_CHOICES])(
    'the template $name wins over the SDK of the Xcode project',
    async ({ xcode, destination }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
            'Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
        });
        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopeEntries: [],
            manifests: readManifests(),
        });
        const text = initSettingsText(
            {
                configurations: ['swift', 'xcode'],
                scopes: [],
                hooks: false,
                ci: 'none',
                rules: false,

                template: parseTemplate(stringify({ xcode }), 'swift.template.toml'),
            },
            repository,
            readManifests(),
            new Map(),
        );
        const session = await openSession(sandbox.path, {
            settings: parseSettings(text),
            text,
        });
        const choices = session.scopes[0]!.view.options('xcode');
        expect(choices.project).toBe(xcode.project);
        expect(choices.destination).toBe(destination);
        expect(await Bun.file(`${sandbox.path}/Unused.xcodeproj/project.pbxproj`).text()).toBe(
            'not native plist syntax',
        );
    },
);

test.each([...LINT_JOBS])(
    'a lint job in $name means init asks no CI question and proposes no CI',
    async ({ path, content }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: content });
        expect(
            proposeCi(sandbox.path, {
                ...EMPTY_EXISTING_TOOLS,
                toolFiles: [...EMPTY_EXISTING_TOOLS.toolFiles],
                hooks: [...EMPTY_EXISTING_TOOLS.hooks],
                agentFiles: [...EMPTY_EXISTING_TOOLS.agentFiles],
                rulesDirectories: [...EMPTY_EXISTING_TOOLS.rulesDirectories],
                lintFolders: [...EMPTY_EXISTING_TOOLS.lintFolders],
                lintOnlyManifests: [...EMPTY_EXISTING_TOOLS.lintOnlyManifests],
                ci: [path],
            }),
        ).toBe('none');
    },
);
