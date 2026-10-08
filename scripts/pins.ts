// Registry validation runs when declared tool versions change, without installing those tools.
import semver from 'semver';
import type { Manifest } from '#cli/types/configurations.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { releaseDocumentSchema } from '#automation/parsers/releases.ts';
import { validateEslintPresets } from '#cli/generation/eslint/public.ts';
import type { RegistryPin, ReleaseDocument } from '#automation/types/pins.ts';
import { RELEASE_ENDPOINTS, RELEASE_NOT_FOUND, REGISTRY_TIMEOUT_MS } from '#automation/config/pins.ts';

// The GitHub token authorizes public release reads and never goes to another registry.
async function releaseDocument(url: string): Promise<ReleaseDocument | undefined> {
    const token = environmentVariables()['GITHUB_TOKEN'];
    const headers: Record<string, string> = { accept: 'application/json' };
    if (url.startsWith('https://api.github.com/') && token !== undefined && token !== '')
        headers['authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
    if (response.status === RELEASE_NOT_FOUND) return undefined;
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}.`);
    return releaseDocumentSchema.parse(await response.json());
}

if (import.meta.main) {
    validateEslintPresets(configurationManifests());
    const manifests = [...configurationManifests().values()];
    const pins = releasedPins(manifests);
    const eslintPin = manifests.flatMap((manifest) => manifest.tools).find((tool) => tool.name === 'eslint')?.version;
    const problems = await validateReleases(pins, eslintPin);
    if (problems.length > 0) {
        console.error(problems.join('\n'));
        process.exitCode = 1;
    } else console.log(`${String(pins.length)} pins exist in their registries.`);
}

/**
 * Select one registry request per released package version across configuration owners.
 * @param manifests the configurations declaring tool releases
 * @returns distinct released versions. System tools and the workspace plugin have no registry request
 */
export function releasedPins(manifests: Manifest[]): RegistryPin[] {
    const pins = new Map<string, RegistryPin>();
    for (const tool of manifests.flatMap((manifest) => manifest.tools)) {
        if (tool.system === true) continue;
        for (const [installer, entry] of Object.entries(tool.installers)) {
            const version = entry.version ?? tool.version;
            const endpoint = RELEASE_ENDPOINTS[installer];
            if (version === undefined || endpoint === undefined || entry.name === '@gspothq/eslint-plugin') continue;
            const url = endpoint.replace('{name}', entry.name).replace('{version}', version);
            pins.set(url, { tool: tool.name, installer, name: entry.name, version, url });
        }
    }
    return [...pins.values()];
}

/**
 * Verify release existence and the ESLint compatibility each npm release declares.
 * @param pins the distinct registry releases
 * @param eslintPin the declared ESLint version, when selected
 * @returns actionable problems without downloaded tool packages
 */
export async function validateReleases(pins: RegistryPin[], eslintPin: string | undefined): Promise<string[]> {
    const problems: string[] = [];
    for (const pin of pins) {
        const document = await releaseDocument(pin.url);
        if (document === undefined) {
            problems.push(`${pin.tool}: ${pin.installer} has no ${pin.name}@${pin.version} (${pin.url}).`);
            continue;
        }
        const range = document.peerDependencies?.['eslint'];
        if (
            pin.installer === 'npm' &&
            range !== undefined &&
            eslintPin !== undefined &&
            !semver.satisfies(eslintPin, range)
        )
            problems.push(`${pin.name}@${pin.version} wants eslint ${range}, and the ESLint pin is ${eslintPin}.`);
    }
    return problems;
}
