import { similar, codeList } from '#cli/text.ts';
import type { Manifest, UnknownConfiguration, ConfigurationDeclaration } from '#cli/types/configurations.ts';

/**
 * Names an unavailable configuration and suggests nearby declared names.
 * @param name the requested configuration
 * @param known the declared configuration names
 * @returns the public diagnostic
 */
export function unknownConfigurationMessage(name: string, known: string[]): string {
    const suggestions = similar(name, known);
    return `There is no configuration called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + codeList(suggestions) + '?' : ''} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Reports unknown configuration names without losing their declaration order or location.
 * @param declarations the requested names, with their original fields
 * @param manifests the declared configurations
 * @returns each unknown declaration with its public diagnostic
 */
export function unknownConfigurations<Declaration extends Pick<ConfigurationDeclaration, 'name'>>(
    declarations: readonly Declaration[],
    manifests: ReadonlyMap<string, Manifest>,
): UnknownConfiguration<Declaration>[] {
    const known = [...manifests.keys()];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map((declaration) => ({
            ...declaration,
            message: unknownConfigurationMessage(declaration.name, known),
        }));
}

/**
 * Name an unknown check and suggest nearby checks from the caller's native inventory.
 * @param name the requested check ID
 * @param known the check IDs available to the caller
 * @returns the shared selection diagnostic
 */
export function unknownCheckMessage(name: string, known: string[]): string {
    const suggestions = similar(name, known);
    return `There is no check called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + codeList(suggestions) + '?' : ''}`;
}
