// Refuses a release whose npm pins came out within the release hold. The release task runs it on Bun before it tags.
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { listPackagePins } from '#cli/tools/pins.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { generalTableSchemas } from '#cli/schemas/settings/general.ts';
import { GSPOT_PACKAGES, MILLISECONDS_PER_DAY } from '#cli/config/tools/installers.ts';

type PinRelease = { pin: string; released: number };

const LOOKUP_BATCH = 8;

const run = promisify(execFile);

async function readRelease(name: string, version: string): Promise<PinRelease> {
    const pin = `${name}@${version}`;
    const { stdout } = await run('npm', ['view', pin, 'time', '--json']);
    const times: unknown = JSON.parse(stdout);
    const time = typeof times === 'object' && times !== null ? (times as Record<string, unknown>)[version] : undefined;
    if (typeof time !== 'string') throw new TypeError(`The npm registry has no publish time for ${pin}.`);
    return { pin, released: Date.parse(time) };
}

async function readReleases(pins: Array<[string, string]>): Promise<PinRelease[]> {
    const releases: PinRelease[] = [];
    for (let start = 0; start < pins.length; start += LOOKUP_BATCH) {
        const batch = pins.slice(start, start + LOOKUP_BATCH);
        releases.push(...(await Promise.all(batch.map(([name, version]) => readRelease(name, version)))));
    }
    return releases;
}

const days = generalTableSchemas.dependencies.unwrap().parse({}).min_release_age_days;
const cutoff = Date.now() - days * MILLISECONDS_PER_DAY;
const gspotPackages: readonly string[] = GSPOT_PACKAGES;
const pins = Object.entries(listPackagePins(readConfigurations().values().toArray()).npm).filter(
    ([name]) => !gspotPackages.includes(name),
);
const releases = await readReleases(pins);
const young = releases.filter(({ released }) => released > cutoff);
for (const { pin, released } of young)
    process.stderr.write(
        `${pin} came out on ${new Date(released).toISOString()}, within the ${String(days)} days that dependencies.min_release_age_days holds a release back. Pin an older release, or wait.\n`,
    );
process.exitCode = young.length > 0 ? 1 : 0;
