import { expect, test } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import type { CarriedConfiguration } from '#cli/policy/adoption/results.ts';

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
    'configs',
    'naming',
    'formatting',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
];

const NOTHING_CARRIED: CarriedConfiguration = {
    tools: new Map(),
    scopes: new Map(),
    observed: new Map(),
    removed: [],
    unread: [],
    retained: [],
};

test('a proposed policy holds no line over 120 characters and reads back as written', () => {
    const text = proposeText({
        configurations: CONFIGURATIONS,
        scopes: [{ path: 'apps/site', configurations: CONFIGURATIONS.slice(0, 12) }],
        carried: NOTHING_CARRIED,
        hooks: 'gspot',
        ci: 'none',
        rules: true,
        runner: 'none',
    });
    const long = text.split('\n').filter((line) => line.length > 120);
    expect(long).toStrictEqual([]);
    expect(text).toContain('configurations = [\n    "typescript",\n');
    const policy = parsePolicyText(text, 'gspot.toml');
    expect(policy.configurations).toStrictEqual(CONFIGURATIONS);
    expect(policy.scopes[0]?.configurations).toStrictEqual(CONFIGURATIONS.slice(0, 12));
});
