import { z } from 'zod';
import pLimit from 'p-limit';
import { listPackagePins } from '#cli/tools/pins.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { generalTableSchemas } from '#cli/schemas/settings/general.ts';
import { GSPOT_PACKAGES, SECONDS_PER_DAY } from '#cli/config/tools/installers/npm.ts';

const lookupLimit = pLimit(8);
const npmTimesSchema = z.record(z.string(), z.string());
const pypiReleaseSchema = z.object({ urls: z.object({ upload_time_iso_8601: z.string() }).array().min(1) });

async function readNpmRelease(name: string, version: string): Promise<number> {
    const result = await spawnProcess(['npm', 'view', `${name}@${version}`, 'time', '--json'], { cwd: process.cwd() });
    if (result.code !== 0) throw new Error(`The npm view of ${name}@${version} failed: ${result.stderr.trim()}`);
    const time = npmTimesSchema.parse(JSON.parse(result.stdout))[version];
    if (time === undefined) throw new Error(`The npm registry has no publish time for ${name}@${version}.`);
    return Date.parse(time);
}

async function readPypiRelease(name: string, version: string): Promise<number> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PyPI answered HTTP ${String(response.status)} for ${name}==${version}.`);
    const { urls } = pypiReleaseSchema.parse(await response.json());
    return Math.max(...urls.map((file) => Date.parse(file.upload_time_iso_8601)));
}

const days = generalTableSchemas.dependencies.unwrap().parse({}).min_release_age_days;
const cutoff = Date.now() - days * SECONDS_PER_DAY * MILLISECONDS_PER_SECOND;
const pins = listPackagePins(readConfigurations().values().toArray());
const gspotPackages: readonly string[] = GSPOT_PACKAGES;
const releases = await Promise.all([
    ...Object.entries(pins.npm)
        .filter(([name]) => !gspotPackages.includes(name))
        .map(([name, version]) =>
            lookupLimit(async () => ({ pin: `${name}@${version}`, released: await readNpmRelease(name, version) })),
        ),
    ...pins.python.map((pin) => {
        const [name = '', version = ''] = pin.split('==');
        return lookupLimit(async () => ({ pin, released: await readPypiRelease(name, version) }));
    }),
]);
const young = releases.filter(({ released }) => released > cutoff);
for (const { pin, released } of young)
    process.stderr.write(
        `${pin} came out on ${new Date(released).toISOString()}, less than the ${String(days)} days that dependencies.min_release_age_days holds a release back. Pin an older release, or wait.\n`,
    );
process.exitCode = young.length > 0 ? 1 : 0;
