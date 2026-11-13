import { isDeepStrictEqual } from 'node:util';

import type { z } from 'zod';

import {
    ADD_REASON_MESSAGE,
    COVERAGE_LINES_SETTING,
    EMPTY_REASON,
    REASON_WORDS_MIN,
    REMOVAL_REASON_SUGGESTION,
    REMOVED_CONFIGURATIONS,
    SWIFT_TARGET_MESSAGE,
} from '#cli/config/settings/validation.ts';
import { WHITESPACE_RUN } from '#cli/config/system.ts';
import { findChildSchema } from '#cli/settings/lookup.ts';
import { getSettingValue } from '#cli/settings/values/inherit.ts';
import { isTable } from '#cli/system/tables.ts';
import type { ReasonRequirement, Setting } from '#cli/types/manifests.ts';
import type { KeyPath } from '#cli/types/parsers.ts';
import type { AvailableSettings, Settings, SettingsError } from '#cli/types/settings.ts';

function isLimitWeakening(direction: Exclude<ReasonRequirement, 'adding'>, value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    return direction === 'raising' ? value > shipped : value < shipped;
}

function validateReasonValue(reason: unknown, where: KeyPath, path: KeyPath, suggestion?: string): SettingsError[] {
    const written = typeof reason === 'string' ? reason : undefined;
    const message = validateReason(where.map(String).join('.'), written, suggestion);
    return message === undefined ? [] : [{ path, message }];
}

function validateReasonTable(table: unknown, keys: KeyPath): SettingsError[] {
    if (!isTable(table)) return [];
    const suggestion = keys.at(-1) === REMOVED_CONFIGURATIONS ? REMOVAL_REASON_SUGGESTION : undefined;
    return Object.entries(table).flatMap(([name, reason]) =>
        validateReasonValue(reason, [...keys, name], [...keys, name], suggestion),
    );
}

function validateFieldReasons({
    field,
    key,
    child,
    keys,
}: {
    field: z.ZodType | undefined;
    key: string;
    child: unknown;
    keys: KeyPath;
}): SettingsError[] {
    if (field === undefined || (key === 'rules' && keys.includes('tools'))) return [];
    if (key === 'reason') return validateReasonValue(child, keys, [...keys, key]);
    return key === REMOVED_CONFIGURATIONS || field.meta()?.reason_values === true
        ? validateReasonTable(child, [...keys, key])
        : validateSettingReasons(field, child, [...keys, key]);
}

export function validateSettingReasons(schema: z.ZodType | undefined, value: unknown, keys: KeyPath): SettingsError[] {
    if (Array.isArray(value))
        return value.flatMap((element, index) =>
            validateSettingReasons(findChildSchema(schema, index), element, [...keys, index]),
        );
    if (!isTable(value)) return [];
    return Object.entries(value).flatMap(([key, child]) =>
        validateFieldReasons({ field: findChildSchema(schema, key), key, child, keys }),
    );
}

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

export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(WHITESPACE_RUN).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

export function isWeakening(setting: Setting, value: unknown, shipped: unknown): boolean {
    if (setting.reason_for === 'adding') {
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
        (setting.reason_for === 'raising' || setting.reason_for === 'lowering') &&
        isLimitWeakening(setting.reason_for, value, shipped)
    );
}

export function validateSwiftTargets(settings: Settings, availableSettings: AvailableSettings): SettingsError[] {
    const coverageLines = getSettingValue(availableSettings, settings, COVERAGE_LINES_SETTING, '')?.value;
    return (settings.coverage?.swift_target ?? [])
        .map((target, index) => ({ target, index }))
        .filter(
            ({ target }) =>
                typeof coverageLines === 'number' &&
                target.min_line_percent < coverageLines &&
                target.reason === undefined,
        )
        .map(({ index }) => ({
            path: ['coverage', 'swift_target', index, 'reason'],
            message: SWIFT_TARGET_MESSAGE,
        }));
}
