import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { proposeText } from '#cli/commands/init/policy-text.ts';
import { CONFIGURATIONS } from '#tests/config/cli/commands/init/policy-text.ts';

test('a proposed policy holds no line over 120 characters and reads back as written', () => {
    const text = proposeText({
        configurations: CONFIGURATIONS,
        scopes: [{ path: 'apps/site', configurations: CONFIGURATIONS.slice(0, 12) }],
        hooks: true,
        ci: 'none',
        rules: true,
        runner: 'none',
    });
    const long = text.split('\n').filter((line) => line.length > 120);
    expect(long).toStrictEqual([]);
    expect(text).toContain('configurations = [\n    "typescript",\n');
    const policy = parseStrictPolicy(text);
    expect(policy.configurations).toStrictEqual(CONFIGURATIONS);
    expect(policy.scopes[0]?.configurations).toStrictEqual(CONFIGURATIONS.slice(0, 12));
});

test('template settings survive beside the commit scopes init adds', () => {
    const text = proposeText({
        configurations: ['python'],
        scopes: [],
        templateTables: {
            tools: { ruff: { select: ['E'], exclude: ['generated'] } },
            architecture: { roles: { domain: ['domain/**'] } },
        },
        commitScopes: ['api'],
        hooks: false,
        ci: 'none',
        rules: false,
        runner: 'none',
    });
    expect(parse(text)).toMatchObject({
        tools: { ruff: { select: ['E'], exclude: ['generated'] }, commitlint: { scopes: ['api'] } },
        architecture: { roles: { domain: ['domain/**'] } },
    });
});

test('initialization uses its selected runner over the template runner and honors disabled integrations', () => {
    const text = proposeText({
        configurations: ['format'],
        scopes: [],
        templateTables: {
            hooks: { push_files: 'all' },
            ci: { provider: 'github' },
            run_with: 'mise',
            format: { indent_width: 2 },
        },
        hooks: false,
        ci: 'none',
        rules: false,
        runner: 'npm',
    });
    const document = parse(text);
    expect(document).toMatchObject({
        run_with: 'npm',
        format: { indent_width: 2 },
        agent_rules: { folder: '.gspot/rules', enabled: false },
    });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});
