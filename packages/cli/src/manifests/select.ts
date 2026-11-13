import { DOCS_PATHS, SOURCE_FILE_GROUPS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatSimilarNames } from '#cli/system/text/messages.ts';
import type { Configuration, RequirementWalk, WrittenConfiguration } from '#cli/types/manifests.ts';

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
List the configurations that gspot selects with no `configurations` entry: each always-selected configuration.
*/
export function listAlwaysSelected(): string[] {
    return readConfigurations()
        .values()
        .filter((configuration) => configuration.always_selected)
        .map((configuration) => configuration.name)
        .toArray();
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

export function formatAlwaysOnMessage(name: string): string {
    return `${name} is always on, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To ignore one check, run gspot ignore.`;
}

export function assertConfigurationsEditable(names: string[]): void {
    const name = names.find((each) => readConfigurations().get(each)?.always_selected === true);
    if (name !== undefined) throw new GspotError('arguments', formatAlwaysOnMessage(name));
}

/**
Find how one configuration requires another.

@returns the names from `from` down to `required`, or undefined when `from` does not require it.
*/
export function findRequirementChain(required: string, from: string, seen: Set<string>): string[] | undefined {
    if (from === required) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    const requirements = readConfigurations().get(from)?.requires ?? [];
    for (const next of requirements) {
        const rest = findRequirementChain(required, next, seen);
        if (rest !== undefined) return [from, ...rest];
    }
    return undefined;
}

/**
Say why a configuration cannot be removed.

@param chain the names from a kept configuration down to the one that it requires.
*/
export function formatRequiredRemoval(configuration: string, chain: string[]): string {
    return `Cannot remove ${configuration}: ${chain.join(' requires ')}. Remove ${chain[0] as string} first, or keep ${configuration}.`;
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
