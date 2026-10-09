import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { readRepository } from '#cli/repository/public.ts';
import { proposeText } from '#cli/commands/init/contracts.ts';
import type { PolicyDraft } from '#cli/types/commands/init.ts';
import { readFormatTables } from '#cli/commands/init/public.ts';
import { XCODE_METADATA } from '#tests/config/samples/xcode.ts';
import { parseTemplate } from '#cli/policy/document/contracts.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/document/public.ts';

import {
    FORMAT_CASES,
    CONFIGURATIONS,
    FORMAT_REFUSALS,
    SDK_DESTINATIONS,
    SCOPE_FORMAT_FILES,
    SCOPE_FORMAT_CASES,
    MANUAL_SWIFT_CHOICES,
} from '#tests/config/cli/commands/init/policy-text.ts';

test('initialization preserves root and scoped configuration choices', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(sandbox.path, [], [], []);
    const text = proposeText(
        {
            configurations: CONFIGURATIONS,
            scopes: [
                { name: 'site', source: 'project', path: 'apps/site', configurations: CONFIGURATIONS.slice(0, 12) },
            ],
            hooks: true,
            ci: 'none',
            agentRules: true,
            runner: 'none',
        },
        repository,
        configurationManifests(),
        new Map(),
    );
    expect(text).toContain('configurations = ["typescript",');
    const policy = parseStrictPolicy(text);
    expect(policy.configurations).toStrictEqual(CONFIGURATIONS);
    expect(policy.scope['apps/site']?.configurations).toStrictEqual(CONFIGURATIONS.slice(0, 12));
    expect(emitPolicy(text, parseTomlText(text, 'gspot.toml', 'policy'))).toBe(text);
});

test('template settings survive beside the commit scopes init adds', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(sandbox.path, [], [], []);
    const text = proposeText(
        {
            configurations: ['python'],
            scopes: [],
            template: parseTemplate(
                stringify({
                    tools: { commitlint: { types: ['feat'], scopes: ['root'] } },
                    architecture: { roles: { test_harness: ['tests/fixtures'] } },
                }),
                'team.template.toml',
            ),
            commitScopes: ['api'],
            hooks: false,
            ci: 'none',
            agentRules: false,
            runner: 'none',
        },
        repository,
        configurationManifests(),
        new Map(),
    );
    expect(parse(text)).toMatchObject({
        tools: { commitlint: { types: ['feat'], scopes: ['api'] } },
        architecture: { roles: { test_harness: ['tests/fixtures'] } },
    });
});

test('initialization uses its selected runner over the template runner and honors disabled integrations', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(sandbox.path, [], [], []);
    const text = proposeText(
        {
            configurations: ['format'],
            scopes: [],
            template: parseTemplate(
                stringify({
                    hooks: { push_files: 'all' },
                    ci: { provider: 'github' },
                    runner: 'mise',
                    format: { indent_width: 2 },
                }),
                'format.template.toml',
            ),
            hooks: false,
            ci: 'none',
            agentRules: false,
            runner: 'npm',
        },
        repository,
        configurationManifests(),
        new Map(),
    );
    const document = parse(text);
    expect(document).toMatchObject({
        runner: 'npm',
        format: { indent_width: 2 },
        agent_rules: { enabled: false },
    });
    expect(document).not.toHaveProperty('agent_rules.folder');
    expect(parseStrictPolicy(text).agent_rules.folder).toBe('.gspot/rules');
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});

test('template initialization retains owned comments and records copy-once provenance', async () => {
    await using sandbox = await testdir();
    const repository = await readRepository(sandbox.path, [], [], []);
    const template = parseTemplate(
        '# Rule owner\n[agent_rules]\ninstruction_files = ["TEAM.md"]\n',
        'team.template.toml',
    );
    const text = proposeText(
        {
            configurations: [],
            scopes: [],
            template,
            hooks: false,
            ci: 'none',
            agentRules: true,
            runner: 'none',
        },
        repository,
        configurationManifests(),
        new Map(),
    );
    expect(text).toContain(`# Copied from template team, sha256 ${template.digest}.`);
    expect(text).toContain('# Rule owner\n[agent_rules]');
    expect(parse(text)).toMatchObject({ agent_rules: { instruction_files: ['TEAM.md'] } });
    expect(parseStrictPolicy(text).agent_rules.enabled).toBe(true);
    expect(parse(text)).not.toHaveProperty('template');
    expect(parse(text)).not.toHaveProperty('selection');
    expect(emitPolicy(text, parseTomlText(text, 'gspot.toml', 'policy'))).toBe(text);
});

test.each(SDK_DESTINATIONS)('initialization selects the native $sdk destination', async ({ sdk, destination }) => {
    const source = XCODE_METADATA.replace('SDKROOT=macosx', `SDKROOT=${sdk}`);
    await using sandbox = await testdir({ 'App.xcodeproj/project.pbxproj': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    const text = proposeText(
        { configurations: ['swift', 'xcode'], scopes: [], hooks: false, ci: 'none', agentRules: false, runner: 'none' },
        repository,
        configurationManifests(),
        new Map(),
    );
    const session = await openSession(sandbox.path, {
        policy: parseStrictPolicy(text),
        text,
        path: 'gspot.toml',
        errors: [],
    });
    expect(session.scopes[0]!.view.options('swift').xcode_destination).toBe(destination);
    expect(await Bun.file(`${sandbox.path}/App.xcodeproj/project.pbxproj`).text()).toBe(source);
});

test.each(MANUAL_SWIFT_CHOICES)(
    'initialization respects the template $name before reading SDK metadata',
    async ({ swift, destination }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
            'Chosen.xcodeproj/project.pbxproj': XCODE_METADATA,
        });
        const repository = await readRepository(sandbox.path, [], [], []);
        const text = proposeText(
            {
                configurations: ['swift', 'xcode'],
                scopes: [],
                hooks: false,
                ci: 'none',
                agentRules: false,
                runner: 'none',
                template: parseTemplate(stringify({ swift }), 'swift.template.toml'),
            },
            repository,
            configurationManifests(),
            new Map(),
        );
        const session = await openSession(sandbox.path, {
            policy: parseStrictPolicy(text),
            text,
            path: 'gspot.toml',
            errors: [],
        });
        const choices = session.scopes[0]!.view.options('swift');
        expect(choices.xcode_project).toBe(swift.xcode_project);
        expect(choices.xcode_destination).toBe(destination);
        expect(await Bun.file(`${sandbox.path}/Unused.xcodeproj/project.pbxproj`).text()).toBe(
            'not native plist syntax',
        );
    },
);

test.each(FORMAT_CASES)('initialization preserves $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const repository = await readRepository(sandbox.path, [], [], []);
    const draft: PolicyDraft = {
        configurations: ['format'],
        scopes: [],
        hooks: false,
        ci: 'none',
        agentRules: false,
        runner: 'none',
    };
    const manifests = configurationManifests();
    const formats = await readFormatTables(
        draft,
        repository,
        manifests,
        readPackageManifests(sandbox.path, repository.files),
    );
    const text = proposeText(draft, repository, manifests, formats);
    const session = await openSession(sandbox.path, {
        policy: parseStrictPolicy(text),
        text,
        path: 'gspot.toml',
        errors: [],
    });
    expect(session.scopes[0]!.view.options('format')).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
});

test.each(SCOPE_FORMAT_CASES)('initialization preserves scoped $name', async ({ template, expected }) => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    const repository = await readRepository(sandbox.path, [], [], []);
    const draft: PolicyDraft = {
        configurations: ['format'],
        scopes: ['app', 'app/deep', 'sibling'].map((path) => ({
            name: path,
            path,
            source: 'project',
            configurations: [],
        })),
        hooks: false,
        ci: 'none',
        agentRules: false,
        runner: 'none',
        ...(template ? { template: parseTemplate(template, 'team.template.toml') } : {}),
    };
    const manifests = configurationManifests();
    const formats = await readFormatTables(
        draft,
        repository,
        manifests,
        readPackageManifests(sandbox.path, repository.files),
    );
    const text = proposeText(draft, repository, manifests, formats);
    const session = await openSession(sandbox.path, {
        policy: parseStrictPolicy(text),
        text,
        path: 'gspot.toml',
        errors: [],
    });
    expect(
        session.scopes.map((scope) => [
            scope.scope.path,
            scope.view.options('format').indent_width,
            scope.view.options('format').print_width,
            scope.view.options('format').quotes,
        ]),
    ).toEqual(expected);
    for (const [path, source] of Object.entries(SCOPE_FORMAT_FILES))
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
});

test.each(FORMAT_REFUSALS)('initialization refuses $name without writing', async ({ text, message }) => {
    await using sandbox = await testdir({ '.prettierrc.json': text });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(
        readFormatTables(
            { configurations: ['format'], scopes: [], hooks: false, ci: 'none', agentRules: false, runner: 'none' },
            repository,
            configurationManifests(),
            readPackageManifests(sandbox.path, repository.files),
        ),
    ).rejects.toThrow(message);
    expect(await Bun.file(`${sandbox.path}/.prettierrc.json`).text()).toBe(text);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
});
