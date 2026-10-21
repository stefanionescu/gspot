import { isDeepStrictEqual } from 'node:util';
import { isRecord } from '#cli/system/values.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { REASON_WORDS_MIN } from '#cli/config/settings/values.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ReasonNeeded } from '#cli/types/settings/metadata.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';

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
function validateReason(where: string, reason: string | undefined): string | undefined {
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
 * Find missing or invalid reasons on ignores, declarations, and naming exceptions.
 *
 * @param settings the normalized gspot.toml.
 * @returns the errors in plain English.
 */
function validateSettingReasons(settings: Settings): SettingsError[] {
    function visit(value: unknown, path: KeyPath): SettingsError[] {
        const [field, , table] = path.toReversed();
        if (table === 'tools' && field === 'rules') return [];
        if (Array.isArray(value)) return value.flatMap((entry, index) => visit(entry, [...path, index]));
        if (!isRecord(value)) return [];
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
        ...Object.entries(settings.allowed_words).flatMap(([word, reason]) =>
            buildErrorsAt(['allowed_words', word], validateReason(`allowed_words.${word}`, reason)),
        ),
        ...visit(settings.written, []),
    ];
}

/**
 * Check whether the reason meets the minimum word count.
 *
 * @param reason the written text, if any.
 * @returns whether the reason meets the requirements.
 */
function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
 * Check whether setting `value` for `declaration` loosens `shipped`, so the value needs a reason.
 *
 * @param declaration the setting.
 * @param value what gspot.toml sets.
 * @param shipped the default of the configuration.
 * @returns whether the value needs a reason.
 */
function isLoosening(declaration: SettingDeclaration, value: unknown, shipped: unknown): boolean {
    if (declaration.reason_needed === 'adding') {
        if (Array.isArray(value))
            return value.some(
                (item) => !Array.isArray(shipped) || !shipped.some((entry) => isDeepStrictEqual(item, entry)),
            );
        if (isRecord(value))
            return Object.entries(value).some(
                ([key, entry]) => !isRecord(shipped) || !isDeepStrictEqual(entry, shipped[key]),
            );
        return !isDeepStrictEqual(value, shipped);
    }
    if (declaration.reason_needed === 'raising' || declaration.reason_needed === 'lowering')
        return isLimitLoosening(declaration.reason_needed, value, shipped);
    return false;
}

export { isLoosening, validateReason, isReasonAccepted, validateSettingReasons };
