// Registry validation runs when declared tool versions change, without installing those tools.
import semver from 'semver';
import { CLI_PINS } from '#cli/config/generation/pins.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { SharedPin, RegistryPin } from '#automation/types/pins.ts';
import { validateEslintPresets } from '#cli/generation/eslint/public.ts';

import {
    githubCommitSchema,
    githubReadmeSchema,
    nodeReleasesSchema,
    githubReleaseSchema,
    releaseDocumentSchema,
} from '#automation/parsers/releases.ts';
import {
    RUNNER_LABEL,
    RETIRED_IMAGE,
    NODE_RELEASES_URL,
    RELEASE_ENDPOINTS,
    RELEASE_NOT_FOUND,
    RUNNER_IMAGES_URL,
    REGISTRY_TIMEOUT_MS,
} from '#automation/config/pins.ts';

// The GitHub token authorizes public release reads and never goes to another registry.
async function releaseDocument(url: string): Promise<unknown> {
    const token = environmentVariables()['GITHUB_TOKEN'];
    const headers: Record<string, string> = { accept: 'application/json' };
    if (url.startsWith('https://api.github.com/') && token !== undefined && token !== '')
        headers['authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
    if (response.status === RELEASE_NOT_FOUND) return undefined;
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}.`);
    return await response.json();
}

if (import.meta.main) {
    validateEslintPresets(configurationManifests());
    const manifests = [...configurationManifests().values()];
    const pins = releasedPins(manifests);
    const eslintPin = manifests.flatMap((manifest) => manifest.tools).find((tool) => tool.name === 'eslint')?.version;
    const errors = [...(await validateReleases(pins, eslintPin)), ...(await validateSharedPins())];
    if (errors.length > 0) {
        console.error(errors.join('\n'));
        process.exitCode = 1;
    } else console.log(`${String(pins.length)} pins exist in their registries.`);
}

// GitHub release metadata supplies both stable versions and action tag identities.
async function githubErrors(pin: SharedPin): Promise<string[]> {
    const release = githubReleaseSchema.parse(
        await releaseDocument(`https://api.github.com/repos/${pin.name}/releases/latest`),
    );
    const pinned = githubReleaseSchema.parse({ tag_name: pin.version });
    const errors = semver.gt(release.version, pinned.version)
        ? [`${pin.name}@${pin.version} has a newer stable release: ${release.tag_name}.`]
        : [];
    if (pin.sha === undefined) return errors;
    const commit = githubCommitSchema.parse(
        await releaseDocument(`https://api.github.com/repos/${pin.name}/commits/${pin.version}`),
    );
    if (commit.sha !== pin.sha)
        errors.push(`${pin.name}@${pin.version} resolves to ${commit.sha}, not the pinned ${pin.sha}.`);
    return errors;
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
 * @returns actionable errors without downloaded tool packages
 */
export async function validateReleases(pins: RegistryPin[], eslintPin: string | undefined): Promise<string[]> {
    const errors: string[] = [];
    for (const pin of pins) {
        const document = await releaseDocument(pin.url);
        if (document === undefined) {
            errors.push(`${pin.tool}: ${pin.installer} has no ${pin.name}@${pin.version} (${pin.url}).`);
            continue;
        }
        const range = releaseDocumentSchema.parse(document).peerDependencies?.['eslint'];
        if (
            pin.installer === 'npm' &&
            range !== undefined &&
            eslintPin !== undefined &&
            !semver.satisfies(eslintPin, range)
        )
            errors.push(`${pin.name}@${pin.version} wants eslint ${range}, and the ESLint pin is ${eslintPin}.`);
    }
    return errors;
}

/**
 * Compare shared release identities, the Node major and hosted labels with their stable upstream lists.
 * @returns unavailable pins and newer stable choices without changing the table
 */
export async function validateSharedPins(): Promise<string[]> {
    const grammar = CLI_PINS.swiftGrammar;
    const grammarPath = new URL(grammar.url).pathname;
    const pins: SharedPin[] = [
        ...Object.values(CLI_PINS.actions),
        { name: CLI_PINS.mise.name, version: `v${CLI_PINS.mise.version}` },
        { name: grammarPath.slice(1, grammarPath.indexOf('/releases/')), version: grammar.version },
    ];
    const errors: string[] = [];
    for (const pin of pins) {
        const url = RELEASE_ENDPOINTS.github.replace('{name}', pin.name).replace('{version}', pin.version);
        if ((await releaseDocument(url)) === undefined)
            errors.push(`${pin.name} has no release ${pin.version} (${url}).`);
        else errors.push(...(await githubErrors(pin)));
    }
    const nodes = nodeReleasesSchema.parse(await releaseDocument(NODE_RELEASES_URL));
    const majors = nodes.filter((release) => release.lts !== false).map((release) => semver.major(release.version));
    const current = Number(CLI_PINS.node);
    if (!majors.includes(current)) errors.push(`Node ${CLI_PINS.node} has no LTS release in ${NODE_RELEASES_URL}.`);
    const supportedMajor = Math.max(...majors);
    if (supportedMajor > current)
        errors.push(`Node ${CLI_PINS.node} has a newer LTS major: ${String(supportedMajor)}.`);
    const readme = githubReadmeSchema.parse(await releaseDocument(RUNNER_IMAGES_URL));
    const labels = Buffer.from(readme.content, 'base64')
        .toString('utf8')
        .split('\n')
        .filter((line) => line.startsWith('|') && !RETIRED_IMAGE.test(line))
        .flatMap((line) => [...line.matchAll(RUNNER_LABEL)].flatMap((match) => match.slice(1)));
    errors.push(
        ...Object.values(CLI_PINS.runners).flatMap((label) => {
            if (!labels.includes(label)) return [`${label} is absent from the stable hosted runner image list.`];
            const family = label.slice(0, label.indexOf('-'));
            const newest =
                labels
                    .filter((candidate) => candidate.startsWith(`${family}-`))
                    .toSorted((left, right) => left.localeCompare(right, 'en', { numeric: true }))
                    .at(-1) ?? label;
            return newest === label ? [] : [`${label} has a newer stable hosted image: ${newest}.`];
        }),
    );
    return errors;
}
