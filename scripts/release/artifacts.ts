// Prepare only the standalone archives verified by CI for this release commit.
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import cliPackage from '#cli-package' with { type: 'json' };
import { ARGUMENT_START } from '#automation/config/paths.ts';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { BINARY_TARGETS, CHECKSUM_PATTERN } from '#automation/config/release.ts';

const [input, output, ...excess] = process.argv.slice(ARGUMENT_START);
if (input === undefined || output === undefined || excess.length > 0)
    throw new Error('Specify the folders containing the CI binary artifacts and the prepared release archives.');
const destination = resolve(output);
const prepared = Object.keys(BINARY_TARGETS).map((target) => {
    const name = `gspot-${cliPackage.version}-${target}.tar.gz`;
    const artifact = join(resolve(input), `gspot-binary-${target}`);
    const archive = join(artifact, name);
    const recorded = readFileSync(join(artifact, 'SHA256SUMS'), 'utf8').trim();
    const checksum = CHECKSUM_PATTERN.exec(recorded);
    if (checksum?.groups?.['name'] !== name)
        throw new Error(`The ${target} CI artifact must contain the checksum for ${name}.`);
    const installed = createHash('sha256').update(readFileSync(archive)).digest('hex');
    if (installed !== checksum.groups['checksum']) throw new Error(`The CI archive checksum differs: ${name}.`);
    return { archive, name, checksum: installed };
});
mkdirSync(destination, { recursive: true });
for (const artifact of prepared) copyFileSync(artifact.archive, join(destination, artifact.name));
writeFileSync(
    join(destination, 'SHA256SUMS'),
    prepared.map((artifact) => `${artifact.checksum}  ${artifact.name}\n`).join(''),
);
console.log(`Verified ${String(prepared.length)} standalone archives for gspot ${cliPackage.version}.`);
