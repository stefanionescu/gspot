import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { ReasonNeeded } from '#cli/types/settings/facts.ts';
import { REASON_WORDS_MIN } from '#cli/config/settings/schema.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { type Settings, type SettingsError } from '#cli/types/settings/file.ts';

function buildErrorsAt(path: KeyPath, text: string | undefined): SettingsError[] {
    return text === undefined ? [] : [{ path, message: text }];
}

function isLimitLoosening(direction: Exclude<ReasonNeeded, 'adding'>, value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    return direction === 'raising' ? value > shipped : value < shipped;
}

/**
 * Describe a missing or invalid reason for commands and saved settings.
 *
 * @param where the setting or command that needs a reason.
 * @param reason the written text, if any.
 * @returns the error, or undefined when the reason meets the requirements.
 */
export function validateReason(where: string, reason: string | undefined): string | undefined {
    if (reason === undefined) return `${where} needs a reason. Add \`reason = "..."\` to this record.`;
    if (isReasonAccepted(reason)) return undefined;
    const refused = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${refused} is refused. Write one sentence saying why.`;
}

function validateRemovedConfigurations(value: unknown, path: KeyPath): SettingsError[] {
    if (!Array.isArray(value) || value.length === 0) return [];
    const missingReason = validateReason(path.map(String).join('.'), undefined);
    return buildErrorsAt([...path, 'reason'], missingReason);
}

/**
 * Find missing or invalid reasons on ignores, reasoned values, naming overrides, and extra tool options.
 *
 * @param settings the normalized gspot.toml.
 * @returns the errors in plain English.
 */
export function validateSettingReasons(settings: Settings): SettingsError[] {
    function visit(value: unknown, path: KeyPath): SettingsError[] {
        const [field, , table] = path.toReversed();
        if (table === 'tools' && field === 'rules') return [];
        if (Array.isArray(value)) return value.flatMap((entry, index) => visit(entry, [...path, index]));
        if (!isTable(value)) return [];
        const reason = value['reason'];
        const own: SettingsError[] = [];
        if (reason !== undefined)
            own.push(
                ...buildErrorsAt(
                    [...path, 'reason'],
                    validateReason(path.map(String).join('.'), typeof reason === 'string' ? reason : undefined),
                ),
            );
        return [
            ...own,
            ...Object.entries(value)
                .filter(([key]) => key !== 'reason' && !(path.length === 0 && key === 'ignore'))
                .flatMap(([key, entry]) => visit(entry, [...path, key])),
        ];
    }
    return [
        ...validateRemovedConfigurations(settings.written['removed_configurations'], ['removed_configurations']),
        ...Object.values(settings.scopes).flatMap((scope, index) =>
            validateRemovedConfigurations(scope.written['removed_configurations'], [
                'scope',
                index,
                'removed_configurations',
            ]),
        ),
        ...settings.ignore.flatMap((entry, index) =>
            buildErrorsAt(['ignore', index, 'reason'], validateReason(`ignore.${String(index)}`, entry.reason)),
        ),
        ...listSettingsTables(settings).flatMap(({ table, path }) => {
            const words = table.spelling?.allowed_words;
            if (words === undefined) return [];
            return Object.entries(words).flatMap(([word, reason]) =>
                buildErrorsAt(
                    [...path, 'spelling', 'allowed_words', word],
                    validateReason(`spelling.allowed_words.${word}`, reason),
                ),
            );
        }),
        ...visit(settings.written, []),
    ];
}

/**
 * Check whether the reason meets the minimum word count.
 *
 * @param reason the written text, if any.
 * @returns whether the reason meets the requirements.
 */
export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
 * Check whether `value` for `setting` loosens `shipped`, so the value needs a reason.
 *
 * @param setting the setting whose reason rule applies.
 * @param value what gspot.toml sets.
 * @param shipped the default of the configuration.
 * @returns whether the value needs a reason.
 */
export function isLoosening(setting: Setting, value: unknown, shipped: unknown): boolean {
    if (setting.reason_needed === 'adding') {
        if (Array.isArray(value))
            return value.some(
                (item) => !Array.isArray(shipped) || !shipped.some((entry) => isDeepStrictEqual(item, entry)),
            );
        if (isTable(value))
            return Object.entries(value).some(
                ([key, entry]) => !isTable(shipped) || !isDeepStrictEqual(entry, shipped[key]),
            );
        return !isDeepStrictEqual(value, shipped);
    }
    if (setting.reason_needed === 'raising' || setting.reason_needed === 'lowering')
        return isLimitLoosening(setting.reason_needed, value, shipped);
    return false;
}
