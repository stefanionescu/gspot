import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { WHITESPACE_RUN } from '#cli/config/text.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ReasonRequirement } from '#cli/types/settings/definitions.ts';
import type { Settings, SettingsError } from '#cli/types/settings/settings.ts';

import {
    EMPTY_REASON,
    REASON_WORDS_MIN,
    ADD_REASON_MESSAGE,
    REMOVAL_REASON_SUGGESTION,
} from '#cli/config/settings/validation.ts';

function isLimitLoosening(direction: Exclude<ReasonRequirement, 'adding'>, value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    return direction === 'raising' ? value > shipped : value < shipped;
}

function validateRemovedConfigurations(value: unknown, keys: KeyPath): SettingsError[] {
    const where = keys.map(String).join('.');
    if (!isTable(value)) return [];
    return Object.entries(value).flatMap(([name, reason]) => {
        const written = typeof reason === 'string' ? reason : undefined;
        const message = validateReason(`${where}.${name}`, written, REMOVAL_REASON_SUGGESTION);
        return message === undefined ? [] : [{ path: [...keys, name], message }];
    });
}

/**
Describe a missing or invalid reason for commands and saved settings.

@param where the setting or command that needs a reason.
@param reason the written text, if any.
@param suggestion how to write the missing reason in this context.
@returns undefined when the reason meets the requirements.
*/
export function validateReason(
    where: string,
    reason: string | undefined,
    suggestion = ADD_REASON_MESSAGE,
): string | undefined {
    if (reason === undefined) return `${where} needs a reason. ${suggestion}`;
    if (isReasonAccepted(reason)) return undefined;
    const refused = reason.trim() === '' ? EMPTY_REASON : `"${reason}"`;
    return `${where} needs a reason of two or more words that says why: ${refused} is refused.`;
}

/**
Find missing or invalid reasons on ignores, reasoned values, and naming overrides.

@param settings the normalized gspot.toml.
*/
export function validateSettingReasons(settings: Settings): SettingsError[] {
    function visit(value: unknown, keys: KeyPath): SettingsError[] {
        const field = keys.at(-1);
        if (field === 'rules' && keys.includes('tools')) return [];
        if (Array.isArray(value)) return value.flatMap((element, index) => visit(element, [...keys, index]));
        if (!isTable(value)) return [];
        const children = Object.entries(value)
            .filter(([key]) => key !== 'reason' && !(key === 'ignore' && keys.length === 0))
            .flatMap(([key, child]) => visit(child, [...keys, key]));
        const reason = value['reason'];
        if (reason === undefined) return children;
        const message = validateReason(keys.map(String).join('.'), typeof reason === 'string' ? reason : undefined);
        return message === undefined ? children : [{ path: [...keys, 'reason'], message }, ...children];
    }
    return [
        ...validateRemovedConfigurations(settings.written['removed_configurations'], ['removed_configurations']),
        ...[...settings.scopes.values()].flatMap((scope, index) =>
            validateRemovedConfigurations(scope.written['removed_configurations'], [
                'scope',
                index,
                'removed_configurations',
            ]),
        ),
        ...settings.ignore.flatMap((ignore, index) => {
            const message = validateReason(`ignore.${String(index)}`, ignore.reason);
            return message === undefined ? [] : [{ path: ['ignore', index, 'reason'], message }];
        }),
        ...listSettingsTables(settings).flatMap(({ table, path }) => {
            const words = table.spelling?.allowed_words;
            if (words === undefined) return [];
            return Object.entries(words).flatMap(([word, reason]) => {
                const message = validateReason(`spelling.allowed_words.${word}`, reason);
                return message === undefined ? [] : [{ path: [...path, 'spelling', 'allowed_words', word], message }];
            });
        }),
        ...visit(settings.written, []),
    ];
}

/**
Check whether the reason meets the minimum word count.

@param reason the written text, if any.
*/
export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(WHITESPACE_RUN).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
Check whether a value loosens the shipped default, so it needs a reason.

@param setting the setting whose reason rule applies.
@param value what gspot.toml sets.
@param shipped the default of the configuration.
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
