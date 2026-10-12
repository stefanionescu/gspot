// Expands setting-bound file patterns and their configuration-owned defaults.
import { literalGlob } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { FileMatch, SettingFilePatterns } from '#cli/types/repository/selection.ts';

/**
 * Expand root-relative setting values or select the namespace's declared files when unset.
 * @param declared file patterns with setting placeholders.
 * @param selected the scope's selected configurations.
 * @param settings the effective root-relative setting values.
 * @returns resolved patterns and configuration-owned fallback file tables.
 */
export function settingFilePatterns(
    declared: string[],
    selected: Manifest[],
    settings: Record<string, unknown>,
): SettingFilePatterns {
    const defaults: FileMatch[] = [];
    // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- reason: Placeholder expansion keeps each path and its configuration defaults together; splitting it adds one-caller wrappers.
    const paths = declared.flatMap((path) => {
        let expanded = [path];
        for (const match of path.matchAll(SETTING_PLACEHOLDER)) {
            const name = match.groups?.['name'] ?? '';
            const value = settings[name];
            if (value === undefined) {
                defaults.push(
                    ...selected
                        .filter((manifest) => manifest.configuration.name === name.split('.', 1)[0])
                        .map((manifest) => manifest.files),
                );
                return [];
            }
            let values: string[] = [];
            if (typeof value === 'string') values = [literalGlob(value)];
            else if (Array.isArray(value)) values = value.filter((entry): entry is string => typeof entry === 'string');
            const next: string[] = [];
            for (const pattern of expanded)
                for (const entry of values) next.push(pattern.replace(match[0], () => entry));
            expanded = next;
        }
        return expanded;
    });
    return { paths, defaults };
}
