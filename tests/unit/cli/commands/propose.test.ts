import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { proposeText } from '#cli/commands/init/propose.ts';

const CONFIGURATIONS = [
    'typescript',
    'javascript',
    'react',
    'nextjs',
    'css',
    'html',
    'markdown',
    'prose',
    'spelling',
    'commits',
    'files',
    'naming',
    'format',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
];

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

test('profile settings survive beside the commit scopes init adds', () => {
    const text = proposeText({
        kits: ['python'],
        scopes: [],
        profileTables: {
            tools: { ruff: { select: ['E'], exclude: ['generated'] } },
            architecture: { types_directory: 'types', config_directory: 'constants' },
        },
        commitScopes: ['api'],
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'none',
    });
    expect(parse(text)).toMatchObject({
        tools: { ruff: { select: ['E'], exclude: ['generated'] }, commitlint: { scopes: ['api'] } },
        architecture: { types_directory: 'types', config_directory: 'constants' },
    });
});

test('initialization keeps the profile runner while honoring disabled integrations', () => {
    const text = proposeText({
        kits: ['format'],
        scopes: [],
        profileTables: {
            hooks: { push: 'all' },
            ci: { provider: 'github' },
            runner: 'mise',
            coverage: { strict: true },
        },
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'mise',
    });
    const document = parse(text);
    expect(document).toMatchObject({
        runner: 'mise',
        coverage: { strict: true },
        guides: { directory: '.gspot/guides', install: false },
    });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});
