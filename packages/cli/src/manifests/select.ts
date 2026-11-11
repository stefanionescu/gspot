import { DOCS_PATHS, SOURCE_FILE_GROUPS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import { type Configuration, type WrittenConfiguration } from '#cli/types/manifests.ts';

type RequirementWalk = { errors: string[]; order: Configuration[]; seen: Set<string> };

function addRequiredConfigurations(walk: RequirementWalk, name: string): void {
    if (walk.seen.has(name)) return;
    walk.seen.add(name);
    const configuration = readConfigurations().get(name);
    if (!configuration) {
        walk.errors.push(...listUnknownConfigurations([{ name }]).map(({ message }) => message));
        return;
    }
    for (const required of configuration.requires) addRequiredConfigurations(walk, required);
    walk.order.push(configuration);
}

export function selectConfigurations(names: string[]): Configuration[] {
    const walk: RequirementWalk = { errors: [], order: [], seen: new Set() };
    for (const configurationName of names) addRequiredConfigurations(walk, configurationName);
    if (walk.errors.length > 0) throw new GspotError('arguments', walk.errors.join('\n'));
    return walk.order;
}

/**
List the configurations whose files hold source code. An always-selected language configuration, such as json or yaml,
reads data files and stays out.
*/
export function listSourceConfigurations(configurations: Configuration[]): Configuration[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return configurations.filter(
        (configuration) => groups.includes(configuration.group) && !configuration.always_selected,
    );
}

export function listSelectedConfigurations(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
): Configuration[] {
    const seen = new Map<string, Configuration>();
    for (const scope of scopes)
        for (const configuration of scope.configurations)
            if (!seen.has(configuration.name)) seen.set(configuration.name, configuration);
    return seen.values().toArray();
}

export function isConfigurationSelected(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
    name: string,
): boolean {
    return scopes.some((scope) => scope.configurations.some((configuration) => configuration.name === name));
}

export function listUnknownConfigurations<Written extends Pick<WrittenConfiguration, 'name'>>(
    written: readonly Written[],
): Array<Written & { message: string }> {
    const configurations = readConfigurations();
    const available = configurations.keys().toArray();
    return written
        .filter(({ name }) => !configurations.has(name))
        .map((missing) => ({
            ...missing,
            message: `There is no configuration called ${missing.name}.${formatSimilarNames(missing.name, available)} See ${DOCS_PATHS.configurations} for the available configurations.`,
        }));
}

export function assertConfigurationsEditable(names: string[]): void {
    const name = names.find((each) => readConfigurations().get(each)?.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `${name} is always on, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To ignore one check, run gspot ignore.`,
        );
}

export function assertConfigurationsExist(names: string[]): void {
    const unknown = listUnknownConfigurations(names.map((name) => ({ name })));
    if (unknown.length > 0) throw new GspotError('arguments', unknown.map(({ message }) => message).join('\n'));
}

export function expandSuggestions(names: string[], detected: Set<string>): string[] {
    const configurations = readConfigurations();
    const suggestions = names.flatMap((name) => configurations.get(name)?.suggests ?? []);
    return [
        ...new Set([
            ...names,
            ...suggestions.filter((name) => {
                const configuration = configurations.get(name);
                const hasDetection =
                    configuration !== undefined &&
                    Object.values(configuration.detect).some((patterns) => Object.keys(patterns).length > 0);
                return !hasDetection || detected.has(name);
            }),
        ]),
    ];
}
