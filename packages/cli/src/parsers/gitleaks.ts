import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { GitleaksEntry } from '#cli/types/parsers/gitleaks.ts';
import { GITLEAKS_BASELINE } from '#cli/config/platform/locations.ts';
import { gitleaksBaselineSchema } from '#cli/parsers/schema/gitleaks.ts';

/**
 * Validate native baseline records without reporting their secret-bearing fields.
 * @param text the baseline file bytes decoded as UTF-8
 * @returns the fingerprint, file, and optional historical commit of each record
 */
export function parseGitleaksBaseline(text: string): GitleaksEntry[] {
    const parsed = parseJsonDocument(text, gitleaksBaselineSchema);
    if ('error' in parsed)
        throw new Error(
            `Cannot read ${GITLEAKS_BASELINE}. Use a JSON array of records with nonempty Fingerprint and File strings and an optional Commit string.`,
        );
    return parsed.data;
}
