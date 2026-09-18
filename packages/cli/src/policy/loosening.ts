// The loosening-needs-a-reason rule.
import { MINIMUM_REASON_WORDS, REFUSED_REASONS } from '#config/reasons.ts';
import type { SettingSpec } from '#types/manifest.ts';

/** True when the reason says something: not a refused token, at least two words. */
export function reasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    if (REFUSED_REASONS.includes(trimmed.toLowerCase())) return false;
    return trimmed.split(/\s+/).filter(Boolean).length >= MINIMUM_REASON_WORDS;
}

/** True when setting `value` for `spec` is a loosening against `shipped` and so carries a reason. */
export function isLoosening(spec: SettingSpec, value: unknown, shipped: unknown): boolean {
    switch (spec.direction) {
        case 'ceiling':
            return typeof value === 'number' && typeof shipped === 'number' && value > shipped;
        case 'floor':
            return typeof value === 'number' && typeof shipped === 'number' && value < shipped;
        case 'loosening':
            return true;
        case 'tightening':
        case 'neutral':
        case 'per-rule':
            return false;
    }
}

/** A tool turned off, a group removed, a rule off: each is a loosening. */
export function disablingNeedsReason(value: unknown): boolean {
    return value === false;
}
