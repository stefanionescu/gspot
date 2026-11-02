import { stringify } from '@decimalturn/toml-patch';
import { type Check, type Configuration } from '#cli/types/manifests.ts';
import { listChecksById, readConfigurations, parseConfigurations } from '#cli/manifests/read.ts';

export function listAlwaysSelected(): string[] {
    return readConfigurations()
        .values()
        .filter((configuration) => configuration.always_selected)
        .map((configuration) => configuration.name)
        .toArray();
}

/**
Parse a manifest.toml for one test, with fields.tables appended as TOML.
*/
export function buildConfiguration(
    name: string,
    fields: { requires?: string[]; tables?: string; group?: Configuration['group'] } = {},
): Configuration {
    const header = stringify({
        configuration: {
            title: name,
            requires: fields.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    const folder = `src/configurations/${fields.group ?? 'language'}/${name}`;
    return parseConfigurations([{ folder, text: `${header}${fields.tables ?? ''}` }]).get(name) as Configuration;
}

/**
Read one shipped check by ID, rejecting unknown names.
*/
export function getShippedCheck(checkId: string): Check {
    const declaration = listChecksById(readConfigurations().values()).get(checkId);
    if (declaration === undefined) throw new Error(`The shipped check ${checkId} does not exist.`);
    return declaration.check;
}
