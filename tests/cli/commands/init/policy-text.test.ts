import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { readRepository } from '#cli/repository/public.ts';
import { proposeText } from '#cli/commands/init/contracts.ts';
import { XCODE_METADATA } from '#tests/config/samples/xcode.ts';
import { parseTemplate } from '#cli/policy/document/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/document/public.ts';
import { CONFIGURATIONS, SDK_DESTINATIONS, MANUAL_SWIFT_CHOICES } from '#tests/config/cli/commands/init/policy-text.ts';

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
