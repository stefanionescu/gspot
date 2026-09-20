import { test, expect, describe } from 'bun:test';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { environmentVariables, isReleaseTestWanted } from '#cli/platform/environment.ts';

const REQUEST_MS = 15_000;
const REGISTRIES = ['npm', 'pypi', 'cargo', 'github'] as const;
const pins = new Map<string, { registry: (typeof REGISTRIES)[number]; name: string; version: string }>();
const tools = presetManifests()
    .values()
    .flatMap((manifest) => manifest.tools);
for (const tool of tools)
    for (const registry of REGISTRIES) {
        const pin = tool.installers[registry];
        if (pin?.version !== undefined && pin.name !== '@gspot/eslint-plugin')
            pins.set(`${registry}:${pin.name}@${pin.version}`, { registry, name: pin.name, version: pin.version });
    }

function publishedVersion(registry: (typeof REGISTRIES)[number], metadata: Record<string, unknown>): unknown {
    switch (registry) {
        case 'npm': {
            return metadata['version'];
        }
        case 'pypi': {
            return (metadata['info'] as Record<string, unknown>)['version'];
        }
        case 'cargo': {
            return (metadata['version'] as Record<string, unknown>)['num'];
        }
        case 'github': {
            return metadata['tag_name'];
        }
    }
}

function metadataUrl(registry: (typeof REGISTRIES)[number], name: string, version: string): string {
    const packageName = encodeURIComponent(name);
    const release = encodeURIComponent(version);
    switch (registry) {
        case 'npm': {
            return `https://registry.npmjs.org/${packageName}/${release}`;
        }
        case 'pypi': {
            return `https://pypi.org/pypi/${packageName}/${release}/json`;
        }
        case 'cargo': {
            return `https://crates.io/api/v1/crates/${packageName}/${release}`;
        }
        case 'github': {
            return `https://api.github.com/repos/${name}/releases/tags/${release}`;
        }
    }
}

describe.skipIf(!isReleaseTestWanted())('published tool pins', () => {
    for (const [identity, pin] of pins)
        test(
            identity,
            async () => {
                const url = metadataUrl(pin.registry, pin.name, pin.version);
                const headers: Record<string, string> = {
                    'User-Agent': 'gspot release verification',
                    Accept: 'application/json',
                };
                const token = environmentVariables()['GITHUB_TOKEN'];
                if (token !== undefined && pin.registry === 'github') headers['Authorization'] = `Bearer ${token}`;
                const response = await fetch(url, {
                    headers,
                    signal: AbortSignal.timeout(REQUEST_MS),
                });
                expect(response.ok, `${url}: HTTP ${String(response.status)}`).toBe(true);
                const version = publishedVersion(
                    pin.registry,
                    (await response.json()) as Parameters<typeof publishedVersion>[1],
                );
                expect(version).toBe(pin.version);
            },
            REQUEST_MS + 1000,
        );
});
