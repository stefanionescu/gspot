import { test, spyOn, expect } from 'bun:test';
import { npmPackSchema } from '#automation/parsers/npm.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { releasedPins, validateReleases } from '#automation/pins.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test('pin validation requests shared releases once and leaves system tools and unpublished workspace packages out', () => {
    const configuration = configurationManifests().get('javascript')!;
    const duplicate = { ...configuration, configuration: { ...configuration.configuration, name: 'shared' } };
    const pins = releasedPins([configuration, duplicate]);
    expect(pins.length).toBeGreaterThan(0);
    expect(new Set(pins.map((pin) => pin.url)).size).toBe(pins.length);
    expect(pins.some((pin) => pin.name === '@gspothq/eslint-plugin')).toBe(false);
    const system = parseConfigurationManifest('system');
    system.tools = [{ name: 'external', system: true, kind: 'binary', installers: { npm: { name: 'external' } } }];
    expect(releasedPins([system])).toStrictEqual([]);
});

test('pin validation reports missing releases and incompatible ESLint peers, preserving registry failures', async () => {
    const pin = {
        tool: 'lint',
        installer: 'npm',
        name: 'lint',
        version: '1.0.0',
        url: 'https://registry.npmjs.org/lint/1.0.0',
    };
    const requests = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    try {
        expect(await validateReleases([pin], '9.39.5')).toStrictEqual([
            'lint: npm has no lint@1.0.0 (https://registry.npmjs.org/lint/1.0.0).',
        ]);
        requests.mockResolvedValue(Response.json({ peerDependencies: { eslint: '^8.0.0' } }));
        expect(await validateReleases([pin], '9.39.5')).toStrictEqual([
            'lint@1.0.0 wants eslint ^8.0.0, and the ESLint pin is 9.39.5.',
        ]);
        requests.mockResolvedValue(Response.json({ peerDependencies: { eslint: '^9.0.0' } }));
        expect(await validateReleases([pin], '9.39.5')).toStrictEqual([]);
        requests.mockResolvedValue(new Response(null, { status: 429 }));
        expect(await rejection(validateReleases([pin], '9.39.5'))).toContain('answered 429');
    } finally {
        requests.mockRestore();
    }
});

test('pin validation rejects malformed registry metadata before compatibility checks', async () => {
    const pin = {
        tool: 'lint',
        installer: 'npm',
        name: 'lint',
        version: '1.0.0',
        url: 'https://registry.npmjs.org/lint/1.0.0',
    };
    const requests = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ peerDependencies: 'invalid' }));
    try {
        expect(await rejection(validateReleases([pin], '9.39.5'))).toContain('peerDependencies');
    } finally {
        requests.mockRestore();
    }
});

test('npm packing metadata accepts local archives and rejects missing or escaping output names', () => {
    expect(npmPackSchema.parse([{ filename: 'package-1.0.0.tgz' }])[0].filename).toBe('package-1.0.0.tgz');
    expect(() => npmPackSchema.parse([])).toThrow('Invalid input: expected object, received undefined');
    for (const filename of ['../outside.tgz', String.raw`folder\outside.tgz`])
        expect(() => npmPackSchema.parse([{ filename }])).toThrow('Invalid string: must match pattern');
});
