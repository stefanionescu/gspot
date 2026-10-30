import { LIMIT_READERS } from '#cli/config/planning.ts';
import { findSettingsSkip } from '#cli/planning/skips.ts';
import type { SettingReader } from '#cli/types/planning.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Settings } from '#cli/types/settings/settings.ts';

/**
List the selected checks that read a limit and whether its rules run at this level.

@param settings the repository level and ignores.
@param scope the selected configurations and settings of one folder.
@param key the setting whose consumers to find.
*/
export function listSettingReaders(settings: Settings, scope: Scope, key: string): SettingReader[] {
    if (!key.startsWith('limits.')) return [];
    const names = key.slice('limits.'.length).split('.');
    const limit = names.at(-1) as string;
    const language = names.length === 1 ? undefined : names[0];
    const checks = scope.configurations.flatMap((configuration) => configuration.checks);
    return LIMIT_READERS.filter(
        (reader) => reader.limits.includes(limit) && (language === undefined || reader.languages.includes(language)),
    ).flatMap((reader) => {
        const check = checks.find((check) => check.id === reader.check);
        if (check === undefined) return [];
        const skip = findSettingsSkip(settings, scope, check);
        const note = settings.level === 'all' ? skip?.note : `off at level ${settings.level}`;
        return [{ check: check.id, enabled: note === undefined, ...(note !== undefined && { note }) }];
    });
}
