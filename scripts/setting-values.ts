import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { readFileSync, writeFileSync } from 'node:fs';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import { assertManifests } from '#cli/configurations/errors.ts';
import { settingSchemaSources } from '#cli/generation/setting-values.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { SETTING_VALUES_COMMAND } from '#cli/config/policy/setting-values.ts';

const [flag, ...extra] = process.argv.slice(ARGUMENT_START);
if ((flag !== undefined && flag !== '--check') || extra.length > 0)
    throw new Error(`Use ${SETTING_VALUES_COMMAND} [--check].`);
const manifests = configurationManifests();
assertManifests(manifests);
const sources = settingSchemaSources(manifests.values());
for (const [path, source] of sources) {
    const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages/cli', path);
    const options = { ...(await resolveConfig(target)), filepath: target };
    // Prettier 3.8.1 changes compact method chains on a second formatting pass.
    const formatted = await format(await format(source, options), options);
    if (flag === '--check') {
        if (readFileSync(target, 'utf8') !== formatted)
            throw new Error(`The compiled policy schema is stale. Run ${SETTING_VALUES_COMMAND}.`);
    } else writeFileSync(target, formatted);
}
