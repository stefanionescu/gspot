import { stringify } from '@decimalturn/toml-patch';
import { listChecksById } from '#cli/manifests/checks.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import { readConfigurations, parseConfigurations } from '#cli/manifests/read.ts';

export function buildConfiguration(name: string, { tables }: { tables: string }): Configuration {
    const header = stringify({
        configuration: {
            title: name,
            requires: [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    const folder = `src/configurations/language/${name}`;
    return parseConfigurations([{ folder, text: `${header}${tables}` }]).get(name) as Configuration;
}

export function getShippedCheck(checkId: string): Check {
    const declaration = listChecksById(readConfigurations().values()).get(checkId);
    if (declaration === undefined) throw new Error(`The shipped check ${checkId} does not exist.`);
    return declaration.check;
}
