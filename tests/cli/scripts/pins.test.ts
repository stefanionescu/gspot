import { test, spyOn, expect } from 'bun:test';
import { CLI_PINS } from '#cli/config/generation/pins.ts';
import { npmPackSchema } from '#automation/parsers/npm.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { NODE_RELEASES_URL, RUNNER_IMAGES_URL } from '#automation/config/pins.ts';
import { releasedPins, validateReleases, validateSharedPins } from '#automation/pins.ts';

import {
    githubCommitSchema,
    githubReadmeSchema,
    nodeReleasesSchema,
    githubReleaseSchema,
} from '#automation/parsers/releases.ts';
import {
    ESLINT_PIN,
    INVALID_TAG,
    REGISTRY_PIN,
    MALFORMED_PEER,
    COMPATIBLE_PEER,
    INCOMPATIBLE_PEER,
    RUNNER_IMAGE_CASES,
} from '#tests/config/cli/scripts/pins.ts';

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
    const pin = REGISTRY_PIN;
    const requests = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    try {
        expect(await validateReleases([pin], ESLINT_PIN)).toStrictEqual([
            'lint: npm has no lint@1.0.0 (https://registry.npmjs.org/lint/1.0.0).',
        ]);
        requests.mockResolvedValue(Response.json(INCOMPATIBLE_PEER));
        expect(await validateReleases([pin], ESLINT_PIN)).toStrictEqual([
            'lint@1.0.0 wants eslint ^8.0.0, and the ESLint pin is 9.39.5.',
        ]);
        requests.mockResolvedValue(Response.json(COMPATIBLE_PEER));
        expect(await validateReleases([pin], ESLINT_PIN)).toStrictEqual([]);
        requests.mockResolvedValue(new Response(null, { status: 429 }));
        expect(await rejection(validateReleases([pin], ESLINT_PIN))).toContain('answered 429');
    } finally {
        requests.mockRestore();
    }
});

test('pin validation rejects malformed registry metadata before compatibility checks', async () => {
    const pin = REGISTRY_PIN;
    const requests = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(MALFORMED_PEER));
    try {
        expect(await rejection(validateReleases([pin], ESLINT_PIN))).toContain('peerDependencies');
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

test('shared pin metadata rejects malformed native release, identity, image and LTS documents', () => {
    expect(() => githubReleaseSchema.parse(INVALID_TAG)).toThrow('tag_name');
    expect(() => githubCommitSchema.parse({ sha: '' })).toThrow('sha');
    expect(() => githubReadmeSchema.parse({ content: '', encoding: 'utf8' })).toThrow('encoding');
    expect(() => nodeReleasesSchema.parse([])).toThrow('Invalid input');
});

test.each(RUNNER_IMAGE_CASES)(
    'the %s hosted image keeps update notices separate from invalid pins',
    async (_name, readme, errors, warnings) => {
        const requests = spyOn(globalThis, 'fetch').mockImplementation(
            Object.assign(
                (input: Parameters<typeof fetch>[0]) => {
                    const url = new URL(input instanceof Request ? input.url : input);
                    if (url.href === RUNNER_IMAGES_URL)
                        return Promise.resolve(
                            Response.json({ encoding: 'base64', content: Buffer.from(readme).toString('base64') }),
                        );
                    if (url.href === NODE_RELEASES_URL)
                        return Promise.resolve(Response.json([{ version: `v${CLI_PINS.node}.0.0`, lts: 'native' }]));
                    const action = Object.values(CLI_PINS.actions).find((pin) =>
                        url.pathname.includes(`/${pin.name}/`),
                    );
                    return Promise.resolve(
                        Response.json({
                            sha: action?.sha,
                            tag_name:
                                action?.version ??
                                (url.pathname.includes('/jdx/mise/')
                                    ? `v${CLI_PINS.mise.version}`
                                    : CLI_PINS.swiftGrammar.version),
                        }),
                    );
                },
                { preconnect: fetch.preconnect },
            ),
        );
        const notices = spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(await validateSharedPins()).toStrictEqual([...errors]);
            expect(notices.mock.calls).toStrictEqual(warnings.map((warning) => [...warning]));
            if (_name === 'newer') {
                requests.mockResolvedValue(new Response(null, { status: 503 }));
                expect(await rejection(validateSharedPins())).toContain('answered 503');
            }
        } finally {
            requests.mockRestore();
            notices.mockRestore();
        }
    },
);
