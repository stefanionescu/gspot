// Every pin a manifest names exists in its registry, sits at or above its floor, and fits the ESLint the plugins support.
import { expect, test } from 'bun:test';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const REGISTRY_TIMEOUT_MS = 30_000;

type Pin = { tool: string; installer: string; name: string; version: string };

function pinsOf(tool: ToolPin): Pin[] {
    return Object.entries(tool.installers).flatMap(([installer, entry]) => {
        const version = entry.version ?? tool.version;
        if (version === undefined || !['npm', 'pypi', 'cargo', 'github'].includes(installer)) return [];
        return [{ tool: tool.name, installer, name: entry.name, version }];
    });
}

const tools = [...configurationManifests().values()].flatMap((manifest) => manifest.tools);
// gspot's own packages reach the registry with the first release (D-158), so they are not looked up before it.
const pins = tools
    .filter((tool) => tool.provider !== 'host')
    .flatMap(pinsOf)
    .filter((pin) => !pin.name.startsWith('@gspot/'));
const eslintPin = tools.find((tool) => tool.name === 'eslint')?.version;

async function registryJson(url: string): Promise<Record<string, unknown> | undefined> {
    const token = environmentVariables()['GITHUB_TOKEN'];
    const headers: Record<string, string> = { accept: 'application/json' };
    if (url.startsWith('https://api.github.com/') && token !== undefined && token !== '')
        headers['authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}.`);
    return (await response.json()) as Record<string, unknown>;
}

function registryUrl(pin: Pin): string {
    switch (pin.installer) {
        case 'npm': {
            return `https://registry.npmjs.org/${pin.name}/${pin.version}`;
        }
        case 'pypi': {
            return `https://pypi.org/pypi/${pin.name}/${pin.version}/json`;
        }
        case 'cargo': {
            return `https://crates.io/api/v1/crates/${pin.name}/${pin.version}`;
        }
        default: {
            return `https://api.github.com/repos/${pin.name}/releases/tags/${pin.version}`;
        }
    }
}

// A tool the repository supplies itself, such as its test runner, carries a floor and no pin.
test('every non-host tool carries a version on the tool or on each installer, or a floor when the repository supplies it', () => {
    const unversioned = tools.filter(
        (tool) =>
            tool.provider !== 'host' &&
            tool.version === undefined &&
            tool.floor === undefined &&
            Object.values(tool.installers).some((entry) => entry.version === undefined),
    );
    expect(unversioned.map((tool) => tool.name)).toStrictEqual([]);
});

test('no pin sits below the floor its manifest names', () => {
    const below = tools.filter(
        (tool) =>
            tool.floor !== undefined && tool.version !== undefined && Bun.semver.order(tool.version, tool.floor) < 0,
    );
    expect(below.map((tool) => `${tool.name} ${tool.version ?? ''} < ${tool.floor ?? ''}`)).toStrictEqual([]);
});

test.each(pins)(
    '$installer knows $name@$version',
    async (pin) => {
        const found = await registryJson(registryUrl(pin));
        expect(found, `${pin.tool}: ${registryUrl(pin)}`).toBeDefined();
    },
    REGISTRY_TIMEOUT_MS,
);

test.each(pins.filter((pin) => pin.installer === 'npm' && /eslint/u.test(pin.name) && pin.name !== 'eslint'))(
    'the ESLint pin satisfies the peer range of $name@$version',
    async (pin) => {
        const document = await registryJson(registryUrl(pin));
        const peers = (document?.['peerDependencies'] ?? {}) as Record<string, string>;
        const range = peers['eslint'];
        if (range === undefined) return;
        expect(eslintPin).toBeDefined();
        expect(Bun.semver.satisfies(eslintPin!, range), `${pin.name} wants eslint ${range}`).toBe(true);
    },
    REGISTRY_TIMEOUT_MS,
);
