import type { SettingSpec } from '#cli/configurations/schema.ts';
import { MINIMUM_REASON_WORDS, REFUSED_REASONS } from '#cli/policy/reasons.ts';

function isNumberLoosening(direction: 'ceiling' | 'floor', value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    return direction === 'ceiling' ? value > shipped : value < shipped;
}

/**
 * True when the reason says something: not a refused token, at least two words.
 * @param reason the reason as written, if any
 * @returns whether the reason is accepted
 */
export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    if (REFUSED_REASONS.includes(trimmed.toLowerCase())) return false;
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= MINIMUM_REASON_WORDS;
}

/**
 * True when setting `value` for `spec` is a loosening against `shipped` and so carries a reason.
 * @param spec the setting
 * @param value the value written
 * @param shipped the shipped default
 * @returns whether a reason is needed
 */
export function isLoosening(spec: SettingSpec, value: unknown, shipped: unknown): boolean {
    if (spec.direction === 'loosening') return true;
    if (spec.direction === 'ceiling' || spec.direction === 'floor')
        return isNumberLoosening(spec.direction, value, shipped);
    return false;
}
