import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ReasonRequirement } from '#cli/types/settings/definitions.ts';
import { REASON_WORDS_MIN } from '#cli/config/settings/validation/reasons.ts';
import { type Settings, type SettingsError } from '#cli/types/settings/file.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function buildErrorsAt(path: KeyPath, text: string | undefined): SettingsError[] {
    return text === undefined ? [] : [{ path, message: text }];
}

function isLimitLoosening(direction: Exclude<ReasonRequirement, 'adding'>, value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    return direction === 'raising' ? value > shipped : value < shipped;
}

/**
Describe a missing or invalid reason for commands and saved settings.

@param where the setting or command that needs a reason.
@param reason the written text, if any.
@param suggestion how to write the missing reason in this context.
@returns the error, or undefined when the reason meets the requirements.
*/
export function validateReason(
    where: string,
    reason: string | undefined,
    suggestion = 'Add `reason = "..."` to this record.',
): string | undefined {
    if (reason === undefined) return `${where} needs a reason. ${suggestion}`;
    if (isReasonAccepted(reason)) return undefined;
    const refused = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${refused} is refused. Write one sentence saying why.`;
}

function validateRemovedConfigurations(value: unknown, path: KeyPath): SettingsError[] {
    if (!Array.isArray(value) || value.length === 0) return [];
    return [
        {
            path: [...path, 'reason'],
            message: `${path.map(String).join('.')} needs a reason. Run gspot remove <configuration> --reason "<why>".`,
        },
    ];
}

/**
Find missing or invalid reasons on ignores, reasoned values, and naming overrides.

@param settings the normalized gspot.toml.
@returns the errors in plain English.
*/
export function validateSettingReasons(settings: Settings): SettingsError[] {
    function visit(value: unknown, path: KeyPath): SettingsError[] {
        const field = path.at(-1);
        if (field === 'rules' && path.includes('tools')) return [];
        if (Array.isArray(value)) return value.flatMap((element, index) => visit(element, [...path, index]));
        if (!isTable(value)) return [];
        const reason = value['reason'];
        const own: SettingsError[] = [];
        if (reason !== undefined) {
            const reasonKey = path.map(String).join('.');
            const errors = validateReason(reasonKey, typeof reason === 'string' ? reason : undefined);
            own.push(...buildErrorsAt([...path, 'reason'], errors));
        }
        return [
            ...own,
            ...Object.entries(value)
                .filter(([key]) => key !== 'reason' && !(key === 'ignore' && path.length === 0))
                .flatMap(([key, child]) => visit(child, [...path, key])),
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
        ...settings.ignore.flatMap((ignore, index) =>
            buildErrorsAt(['ignore', index, 'reason'], validateReason(`ignore.${String(index)}`, ignore.reason)),
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
Check whether the reason meets the minimum word count.

@param reason the written text, if any.
@returns whether the reason meets the requirements.
*/
export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
Check whether `value` for `setting` loosens `shipped`, so the value needs a reason.

@param setting the setting whose reason rule applies.
@param value what gspot.toml sets.
@param shipped the default of the configuration.
@returns whether the value needs a reason.
*/
export function isLoosening(setting: Setting, value: unknown, shipped: unknown): boolean {
    if (setting.reason_when === 'adding') {
        if (Array.isArray(value))
            return value.some(
                (element) =>
                    !Array.isArray(shipped) ||
                    shipped.every((shippedElement) => !isDeepStrictEqual(element, shippedElement)),
            );
        if (isTable(value))
            return Object.entries(value).some(
                ([key, child]) => !isTable(shipped) || !isDeepStrictEqual(child, shipped[key]),
            );
        return !isDeepStrictEqual(value, shipped);
    }
    return (
        (setting.reason_when === 'raising' || setting.reason_when === 'lowering') &&
        isLimitLoosening(setting.reason_when, value, shipped)
    );
}
