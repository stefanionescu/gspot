import { readGitText } from '#cli/system/git.ts';
import { compareText } from '#cli/system/text.ts';
import { MILLISECONDS_PER_DAY } from '#cli/config/units.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

import {
    miseVersionsSchema,
    npmPackageTimesSchema,
    pypiReleaseFilesSchema,
} from '#cli/schemas/configurations/pin-ages.ts';

const MISE_RELEASE_TOOLS: Record<string, string> = { deno: 'github:denoland/deno' };

async function readNpmTime(name: string, version: string): Promise<string> {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error(`The npm registry could not read ${name}: HTTP ${String(response.status)}.`);
    const document = npmPackageTimesSchema.parse(await response.json());
    const time = document.time[version];
    if (time === undefined) throw new Error(`The npm registry has no publish time for ${name}@${version}.`);
    return time;
}

async function readPypiTime(name: string, version: string): Promise<string> {
    const response = await fetch(
        `https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`,
    );
    if (!response.ok) throw new Error(`PyPI could not read ${name}: HTTP ${String(response.status)}.`);
    const document = pypiReleaseFilesSchema.parse(await response.json());
    const times = document.urls.map((file) => file.upload_time_iso_8601).toSorted(compareText);
    const time = times.at(-1);
    if (time === undefined) throw new Error(`PyPI has no release files for ${name}==${version}.`);
    return time;
}

function readMiseTime(tool: string, version: string): string | undefined {
    const result = spawnProcessBlocking(
        ['mise', 'ls-remote', MISE_RELEASE_TOOLS[tool] ?? tool, '--json', '--no-versions-host', '--strict-metadata'],
        { cwd: process.cwd() },
    );
    if (result.code !== 0) throw new Error(`The mise command could not read ${tool}: ${result.stderr.trim()}`);
    const versions = miseVersionsSchema.parse(JSON.parse(result.stdout));
    return versions.find((release) => release.version === version)?.created_at;
}

async function checkPinAges(): Promise<void> {
    const configurations = readConfigurations().values().toArray();
    const pins = listToolProjectPins(configurations);
    const date = await readGitText(process.cwd(), ['show', '-s', '--format=%cI', 'HEAD'], {});
    const days = SETTING_DEFINITIONS['dependencies.min_release_age_days'].default;
    const cutoff = Date.parse(date.trim()) - days * MILLISECONDS_PER_DAY;
    const releases = await Promise.allSettled([
        ...Object.entries(pins.npm)
            .filter(([name]) => name !== '@gspothq/eslint-plugin')
            .map(async ([name, version]) => ({ name: `${name}@${version}`, time: await readNpmTime(name, version) })),
        ...pins.python.map(async (pin) => {
            const separator = pin.indexOf('==');
            return { name: pin, time: await readPypiTime(pin.slice(0, separator), pin.slice(separator + '=='.length)) };
        }),
        ...listMisePins(configurations).map(({ name, version }) =>
            Promise.resolve().then(() => ({ name: `${name}@${version}`, time: readMiseTime(name, version) })),
        ),
    ]);
    for (const release of releases) {
        if (release.status === 'rejected') {
            process.stderr.write(`${String(release.reason)}\n`);
            process.exitCode = 1;
            continue;
        }
        const { name, time } = release.value;
        const timestamp = time === undefined ? Number.NaN : Date.parse(time);
        if (!Number.isFinite(timestamp)) {
            process.stderr.write(`${name}: no valid release date.\n`);
            process.exitCode = 1;
        } else if (timestamp > cutoff) {
            process.stderr.write(`${name}: released ${String(time)}, less than ${String(days)} days before HEAD.\n`);
            process.exitCode = 1;
        }
    }
}

await checkPinAges();
