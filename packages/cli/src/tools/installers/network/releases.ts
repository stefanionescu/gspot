import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import {
    NOT_FOUND_STATUS,
    NPM_DEFAULT_REGISTRY,
    NPM_SETTING_PREFIX,
    PYTHON_DEFAULT_INDEX_ORIGIN,
} from '#cli/config/tools/installers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { npmReleaseSchema, pypiReleaseSchema } from '#cli/schemas/tools.ts';
import { prepareProxy } from '#cli/tools/installers/network/downloads.ts';
import type { PackagePins, ToolInstall, ToolRelease } from '#cli/types/tools.ts';

/**
Read the registry page of a release. A registry that gspot cannot reach, or that does not answer in time, gives no
page: fetch rejects with a TypeError for a network failure.
*/
async function readReleasePage(
    install: ToolInstall,
    release: ToolRelease,
): Promise<{ ok: boolean; status: number; text: string } | undefined> {
    try {
        const response = await fetch(release.url, {
            signal: AbortSignal.timeout(install.session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND),
        });
        return { ok: response.ok, status: response.status, text: await response.text() };
    } catch (error) {
        if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError'))
            return undefined;
        throw error;
    }
}

async function readReleaseState(install: ToolInstall, release: ToolRelease): Promise<'absent' | 'held' | undefined> {
    const page = await readReleasePage(install, release);
    if (page === undefined) return undefined;
    if (page.status === NOT_FOUND_STATUS) return 'absent';
    if (!page.ok) return undefined;
    const lookup = tryParseFile(() => ({
        published:
            release.kind === 'npm'
                ? parseJsonFile(release.url, page.text, npmReleaseSchema).time[release.version]
                : parseJsonFile(release.url, page.text, pypiReleaseSchema).urls[0]?.upload_time_iso_8601,
    }));
    if (lookup === undefined) return undefined;
    if (lookup.published === undefined) return 'absent';
    const oldest = Date.now() - install.releaseAgeDays * MILLISECONDS_PER_DAY;
    return new Date(lookup.published).getTime() > oldest ? 'held' : undefined;
}

export function listPythonReleases(pins: readonly string[]): ToolRelease[] {
    return pins.map((pin) => {
        const [name, version] = pin.split('==') as [string, string];
        return {
            label: pin,
            kind: 'python',
            version,
            url: `${PYTHON_DEFAULT_INDEX_ORIGIN}/pypi/${name}/${version}/json`,
        };
    });
}

/**
List the releases of the npm pins in the registry that the package manager environment names.
*/
export function listNpmReleases(pins: PackagePins['npm'], environment: Record<string, string>): ToolRelease[] {
    const registry = environment[`${NPM_SETTING_PREFIX}registry`] ?? NPM_DEFAULT_REGISTRY;
    return Object.entries(pins).map(([name, version]): ToolRelease => ({
        label: `${name}@${version}`,
        kind: 'npm',
        version,
        url: new URL(name.replace('/', '%2f'), registry.endsWith('/') ? registry : `${registry}/`).href,
    }));
}

/**
Say why the registry refused pinned tools that a failed resolution names. A release inside the hold waits for its age,
and a release that the registry does not have needs another pin. A registry that answers with an error or with a page gspot
cannot read, that gspot cannot reach, or that does not answer in time adds nothing.
*/
export async function explainReleaseAgeHold(
    install: ToolInstall,
    output: string,
    releases: readonly ToolRelease[],
): Promise<string> {
    const named = releases.filter((release) => output.includes(release.label));
    if (named.length === 0 || install.releaseAgeDays === 0) return '';
    prepareProxy();
    const releaseStates = await Promise.all(
        named.map(async (release) => {
            return { label: release.label, state: await readReleaseState(install, release) };
        }),
    );
    const absent = releaseStates.filter(({ state }) => state === 'absent').map(({ label }) => label);
    const held = releaseStates.filter(({ state }) => state === 'held').map(({ label }) => label);
    const days = String(install.releaseAgeDays);
    return [
        ...(absent.length === 0 ? [] : [`The registry has no release ${absent.join(', ')}.\n`]),
        ...(held.length === 0
            ? []
            : [
                  `${held.join(', ')} came out less than ${days} days ago. The setting dependencies.min_release_age_days holds back each release for ${days} days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n`,
              ]),
    ].join('');
}
