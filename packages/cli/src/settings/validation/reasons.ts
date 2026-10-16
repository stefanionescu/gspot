import { isDeepStrictEqual } from 'node:util';
import { isRecord } from '#cli/system/values.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { REASON_WORDS_MIN } from '#cli/config/settings/values.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';

function buildErrorsAt(path: KeyPath, text: string | undefined): SettingsError[] {
    return text === undefined ? [] : [{ path, message: text }];
}

function isLimitLoosening(direction: 'raising' | 'lowering', value: unknown, shipped: unknown): boolean {
    if (
        (typeof value !== 'number' && typeof value !== 'boolean') ||
        (typeof shipped !== 'number' && typeof shipped !== 'boolean')
    )
        return false;
    return direction === 'raising' ? Number(value) > Number(shipped) : Number(value) < Number(shipped);
}

/**
 * Describe a missing or invalid reason for commands and saved settings.
 * @param where the settings entry or command needing a reason.
 * @param reason the written explanation, when present.
 * @param command an available command that can correct the entry.
 * @returns the error, or undefined when the reason meets the requirements.
 */
function validateReason(where: string, reason: string | undefined, command?: string): string | undefined {
    if (reason === undefined)
        return `${where} needs a reason. Add \`reason = "..."\` to this entry.${command === undefined ? '' : ' Or run: ' + command}`;
    if (isReasonAccepted(reason)) return undefined;
    const refused = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${refused} is refused. Write one sentence saying why.`;
}

// The tool reads extra options; only the surrounding envelope carries a gspot reason.
function validateExtraReason(entry: Record<string, unknown>, path: KeyPath): SettingsError[] {
    const reason = entry['reason'];
    return buildErrorsAt(
        [...path, 'reason'],
        validateReason(path.map(String).join('.'), typeof reason === 'string' ? reason : undefined),
    );
}

function ignoreErrors(settings: Settings): SettingsError[] {
    return settings.ignore.flatMap((entry, index) =>
        buildErrorsAt(['ignore', index, 'reason'], validateReason(`ignore.${String(index)}`, entry.reason)),
    );
}

/**
 * Missing or invalid reasons on ignores, declarations, naming exceptions, and custom tool options.
 * @param settings the normalized settings.
 * @returns the errors in plain English.
 */
function validateSettingReasons(settings: Settings): SettingsError[] {
    function visit(value: unknown, path: KeyPath): SettingsError[] {
        const [field, , table] = path.toReversed();
        if (table === 'tools' && field === 'rules') return [];
        if (Array.isArray(value)) return value.flatMap((entry, index) => visit(entry, [...path, index]));
        if (!isRecord(value)) return [];
        if (path.at(-1) === 'extra') return validateExtraReason(value, path);
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
                .filter(
                    ([key]) =>
                        key !== 'reason' &&
                        !(path.length === 0 && key === 'ignore') &&
                        !(key === 'value' && path.at(-1) === 'extra'),
                )
                .flatMap(([key, entry]) => visit(entry, [...path, key])),
        ];
    }
    return [...ignoreErrors(settings), ...visit(settings.written, [])];
}

/**
 * Checks that the reason meets the minimum word count.
 * @param reason the reason as written, if any.
 * @returns whether the reason meets the requirements.
 */
function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
 * True when setting `value` for `declaration` loosens `shipped` and needs a reason.
 * @param declaration the setting.
 * @param value the value written.
 * @param shipped the shipped default.
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

/**
 * Require a setting explanation when loosening values do not carry their own reasons.
 * @param declaration the setting's declared direction.
 * @param before the selected default before the written change.
 * @param after the written value after the change.
 * @returns whether the setting needs a reason in its value envelope.
 */
function isReasonNeeded(declaration: SettingDeclaration, before: unknown, after: unknown): boolean {
    return isLoosening(declaration, after, before);
}

export { isLoosening, validateReason, isReasonNeeded, isReasonAccepted, validateSettingReasons };
