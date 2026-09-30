import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { CONFIGURATIONS } from '#tests/inputs/unit/cli/commands.ts';

test('a proposed policy holds no line over 120 characters and reads back as written', () => {
    const text = proposeText({
        kits: CONFIGURATIONS,
        scopes: [{ path: 'apps/site', kits: CONFIGURATIONS.slice(0, 12) }],
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

test('detected settings override profile values while unrelated profile settings survive', () => {
    const text = proposeText({
        kits: ['python'],
        scopes: [],
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

test('initialization keeps the profile runner while honoring disabled integrations', () => {
    const text = proposeText({
        kits: ['formatting'],
        scopes: [],
        profileTables: {
            hooks: { push: 'all' },
            ci: { provider: 'github' },
            runner: { tool: 'mise' },
            coverage: { strict: true },
        },
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'mise',
    });
    const document = parse(text);
    expect(document).toMatchObject({
        runner: { tool: 'mise' },
        coverage: { strict: true },
        guides: { directory: '.gspot/guides', install: false },
    });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});

test('initialization writes scoped install safeguards as scope tables', () => {
    const text = proposeText({
        kits: ['dependencies'],
        scopes: [
            { path: 'api', kits: ['dependencies'] },
            { path: 'web', kits: ['dependencies'] },
        ],
        install: [
            { path: '', settings: { min_release_age_days: 14 } },
            { path: 'api', settings: { min_release_age_days: 21, security_scanner: 'scope-scanner' } },
        ],
        hooks: 'none',
        ci: 'none',
        rules: true,
        runner: 'none',
    });
    expect(parse(text)).toMatchObject({
        tools: { install: { min_release_age_days: 14 } },
        scope: [
            { path: 'api', tools: { install: { min_release_age_days: 21, security_scanner: 'scope-scanner' } } },
            { path: 'web' },
        ],
    });
});
