// Checks that every tool pin a kit manifest names exists in its registry, and that the ESLint pin satisfies the peer
// range of each pinned ESLint plugin. It calls a registry once per pin, so the scheduled pins workflow runs it.
import semver from 'semver';
import { kitManifests } from '#cli/kits/manifests.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const REGISTRY_TIMEOUT_MS = 30_000;
const NOT_FOUND = 404;
// The address of one released version, for each registry a pin can name.
const RELEASE_URLS = new Map([
    ['npm', (name: string, version: string) => `https://registry.npmjs.org/${name}/${version}`],
    ['pypi', (name: string, version: string) => `https://pypi.org/pypi/${name}/${version}/json`],
    ['cargo', (name: string, version: string) => `https://crates.io/api/v1/crates/${name}/${version}`],
    ['github', (name: string, version: string) => `https://api.github.com/repos/${name}/releases/tags/${version}`],
]);

const tools = [...kitManifests().values()]
    .flatMap((manifest) => manifest.tools)
    .filter(({ provider }) => provider !== 'host');
const eslintPin = tools.find((tool) => tool.name === 'eslint')?.version;
// The ESLint plugin of gspot reaches npm in the same release as its pin, so npm cannot know it before.
const pins = tools.flatMap((tool) =>
    Object.entries(tool.installers).flatMap(([installer, entry]) => {
        const version = entry.version ?? tool.version;
        const url = RELEASE_URLS.get(installer);
        if (version === undefined || url === undefined || entry.name === '@gspothq/eslint-plugin') return [];
        return [{ tool: tool.name, installer, name: entry.name, version, url: url(entry.name, version) }];
    }),
);

// The release document a registry holds for a pin, or undefined when the registry has no such release.
async function releaseDocument(url: string): Promise<Record<string, unknown> | undefined> {
    const token = environmentVariables()['GITHUB_TOKEN'];
    const headers: Record<string, string> = { accept: 'application/json' };
    if (url.startsWith('https://api.github.com/') && token !== undefined && token !== '')
        headers['authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
    if (response.status === NOT_FOUND) return undefined;
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}.`);
    return (await response.json()) as Record<string, unknown>;
}

const problems: string[] = [];
for (const pin of pins) {
    const document = await releaseDocument(pin.url);
    if (document === undefined) {
        problems.push(`${pin.tool}: ${pin.installer} has no ${pin.name}@${pin.version} (${pin.url}).`);
        continue;
    }
    const range = (document['peerDependencies'] as Record<string, string> | undefined)?.['eslint'];
    if (
        pin.installer === 'npm' &&
        range !== undefined &&
        eslintPin !== undefined &&
        !semver.satisfies(eslintPin, range)
    )
        problems.push(`${pin.name}@${pin.version} wants eslint ${range}, and the ESLint pin is ${eslintPin}.`);
}
if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
} else console.log(`${String(pins.length)} pins exist in their registries.`);
