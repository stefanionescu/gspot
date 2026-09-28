import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { CONFIGURATIONS, NOTHING_CARRIED } from '#tests/config/unit/cli/commands.ts';

test('a proposed policy holds no line over 120 characters and reads back as written', () => {
    const text = proposeText({
        kits: CONFIGURATIONS,
        scopes: [{ path: 'apps/site', kits: CONFIGURATIONS.slice(0, 12) }],
        kept: NOTHING_CARRIED,
        hooks: 'gspot',
        ci: 'none',
        rules: true,
        runner: 'none',
    });
    const long = text.split('\n').filter((line) => line.length > 120);
    expect(long).toStrictEqual([]);
    expect(text).toContain('kits = [\n    "typescript",\n');
    const policy = parsePolicyText(text, 'gspot.toml');
    expect(policy.kits).toStrictEqual(CONFIGURATIONS);
    expect(policy.scopes[0]?.kits).toStrictEqual(CONFIGURATIONS.slice(0, 12));
});

test('detected settings override kept and profile values while unrelated profile settings survive', () => {
    const text = proposeText({
        kits: ['python'],
        scopes: [],
        kept: { ...NOTHING_CARRIED, tools: new Map([['ruff', { settings: { select: ['F'] }, ignores: [] }]]) },
        profileTables: {
            tools: { ruff: { select: ['E'], exclude: ['generated'] } },
            architecture: { types_directory: 'types', config_directory: 'constants' },
        },
        detected: [
            { key: 'tools.ruff.select', value: ['I'], kit: 'python' },
            { key: 'architecture.types_directory', value: 'models', kit: 'typescript' },
            { key: 'tools.ruff.select.extra', value: ['B'], kit: 'python' },
            { key: 'architecture.types_directory.extra', value: 'ignored', kit: 'typescript' },
        ],
        commitScopes: ['api'],
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'none',
    });
    expect(parse(text)).toMatchObject({
        tools: { ruff: { select: ['I'], exclude: ['generated'] }, commitlint: { scopes: ['api'] } },
        architecture: { types_directory: 'models', config_directory: 'constants' },
    });
});

test('initialization preserves formatter overrides and profile runner tasks while honoring disabled integrations', () => {
    const text = proposeText({
        kits: ['formatting'],
        scopes: [],
        kept: NOTHING_CARRIED,
        formatter: { format: { print_width: 90 }, extra: { bracketSpacing: false }, nativeDefaults: true },
        profileTables: {
            hooks: { tool: 'husky' },
            ci: { provider: 'github' },
            runner: { tool: 'mise', tasks: { check: 'profile-check', apply: 'profile-apply' } },
            coverage: { strict: true },
        },
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'mise',
        runnerTasks: { check: 'detected-check', fix: 'detected-fix' },
    });
    const document = parse(text);
    expect(document).toMatchObject({
        format: { print_width: 90 },
        tools: { prettier: { extra: { bracketSpacing: false }, native_defaults: true } },
        runner: { tool: 'mise', tasks: { check: 'profile-check', apply: 'profile-apply', fix: 'detected-fix' } },
        coverage: { strict: true },
        guides: { directory: '.gspot/guides', install: false },
    });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});

test('initialization writes scoped reasoned allowances as table arrays', () => {
    const words = [
        {
            word: 'ProtocolName',
            reason: 'The protocol requires this exact spelling in every exported operation and in each generated client interface.',
        },
    ];
    const text = proposeText({
        kits: ['spelling'],
        scopes: [
            { path: 'api', kits: ['spelling'] },
            { path: 'web', kits: ['spelling'] },
        ],
        kept: {
            ...NOTHING_CARRIED,
            scopes: new Map([['api', { kits: ['spelling'], tools: { typos: { words } } }]]),
        },
        hooks: 'none',
        ci: 'none',
        rules: true,
        runner: 'none',
    });
    expect(text).toContain('[[scope.tools.typos.words]]');
    expect(parse(text)).toMatchObject({ scope: [{ path: 'api', tools: { typos: { words } } }, { path: 'web' }] });
});
