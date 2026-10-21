import { GspotError } from '#cli/system/errors.ts';
import { formatUnknownName } from '#cli/system/text.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { SOURCE_FILE_GROUPS } from '#cli/config/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { type Configuration, type SelectionWalk, type WrittenConfiguration } from '#cli/types/configurations.ts';

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    walk.seen.add(configurationName);
    const configuration = walk.configurations.get(configurationName);
    if (!configuration) {
        const known = walk.configurations.keys().toArray();
        walk.errors.push(formatUnknownConfiguration(configurationName, known));
        return;
    }
    for (const required of configuration.requires) visit(walk, required);
    walk.order.push(configuration);
}

/**
 * Resolve configuration names to manifests in order, and throw for unknown names.
 *
 * @param configurationNames the names to resolve.
 * @param configurations every configuration manifest.
 * @returns the manifests, requirements first, in order of first mention.
 */
export function selectConfigurations(
    configurationNames: string[],
    configurations: Map<string, Configuration>,
): Configuration[] {
    const walk: SelectionWalk = { configurations, errors: [], order: [], seen: new Set() };
    for (const configurationName of configurationNames) visit(walk, configurationName);
    if (walk.errors.length > 0) throw new GspotError('arguments', walk.errors.join('\n'));
    return walk.order;
}

/**
 * Keep the language and framework configurations that add source files to shared checks.
 *
 * @param selected the manifests in use.
 * @returns the configurations that own source settings.
 */
export function filterSourceConfigurations(selected: Configuration[]): Configuration[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return selected.filter((configuration) => groups.includes(configuration.group));
}

/**
 * List each manifest of the scopes once, in first-seen order.
 *
 * @param scopes scope selections that can share configurations.
 * @returns one manifest per configuration name.
 */
export function listSelectedConfigurations(scopes: Pick<Scope, 'selected'>[]): Configuration[] {
    const seen = new Map<string, Configuration>();
    for (const scope of scopes)
        for (const configuration of scope.selected)
            if (!seen.has(configuration.name)) seen.set(configuration.name, configuration);
    return seen.values().toArray();
}

/**
 * Check whether any scope selects a configuration.
 *
 * @param scopes the validated scope selections.
 * @param name the configuration to find.
 * @returns whether any scope includes the configuration.
 */
export function isConfigurationSelected(scopes: Pick<Scope, 'selected'>[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((configuration) => configuration.name === name));
}

// Name an unknown configuration, and say where to find the available ones.
function formatUnknownConfiguration(name: string, known: string[]): string {
    return `${formatUnknownName('configuration', name, known)} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Find the unknown configuration names, and keep their order and location.
 *
 * @param written the requested names, with their original fields.
 * @param configurations the declared configurations.
 * @returns each unknown declaration with its error message.
 */
export function listUnknownConfigurations<Written extends Pick<WrittenConfiguration, 'name'>>(
    written: readonly Written[],
    configurations: ReadonlyMap<string, Configuration>,
): (Written & { message: string })[] {
    const known = [...configurations.keys()];
    return written
        .filter(({ name }) => !configurations.has(name))
        .map((entry) => ({
            ...entry,
            message: formatUnknownConfiguration(entry.name, known),
        }));
}

/**
 * Refuse explicit edits to configurations that gspot selects itself.
 *
 * @param names the configurations that the command edits.
 * @param configurations the configuration declarations
 */
export function assertConfigurationsEditable(names: string[], configurations: Map<string, Configuration>): void {
    const name = names.find((entry) => configurations.get(entry)?.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `gspot selects ${name} by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To turn one check off, run gspot ignore.`,
        );
}

/**
 * List the general configurations that gspot adds without an explicit selection.
 *
 * @param configurations every shipped configuration
 * @param repository the available inventory, if any
 * @returns the automatic configurations, each once
 */
export function listAutomaticConfigurations(
    configurations: Map<string, Configuration>,
    repository?: Pick<Repository, 'root' | 'files' | 'hasGit'>,
): string[] {
    const general = new Map([...configurations].filter(([, configuration]) => configuration.group === 'general'));
    const automatic = new Set(
        general
            .values()
            .filter((configuration) => configuration.always_selected && configuration.when === undefined)
            .map((configuration) => configuration.name),
    );
    if (repository === undefined) return [...automatic];
    const detected = new Set(
        detectConfigurations({ ...repository, dependencyFiles: [] }, general).map(({ configuration }) => configuration),
    );
    for (const configuration of general.values())
        if (detected.has(configuration.name) && (configuration.when?.git !== true || repository.hasGit))
            automatic.add(configuration.name);
    return general
        .keys()
        .filter((name) => automatic.has(name))
        .toArray();
}

/**
 * Refuse every unknown configuration named by a command.
 *
 * @param names the requested configuration names.
 * @param configurations every available configuration.
 */
export function assertKnownConfigurations(names: string[], configurations: Map<string, Configuration>): void {
    const unknown = listUnknownConfigurations(
        names.map((name) => ({ name })),
        configurations,
    );
    if (unknown.length > 0) throw new GspotError('arguments', unknown.map(({ message }) => message).join('\n'));
}
