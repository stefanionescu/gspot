import { z } from 'zod';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { asList, asRaw, asStrings, asText } from '#cli/policy/adoption/source.ts';
import { appendSetting, reasonFor, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';

// How an allowlist regex is applied travels with it: against the line, the match or the secret, and whether every part must hold.
function targetKeys(entry: TomlTable): { regex_target?: string; condition?: string } {
    const target = asText(entry['regexTarget']);
    const condition = asText(entry['condition']);
    return {
        ...(target === undefined ? {} : { regex_target: target }),
        ...(condition === undefined ? {} : { condition }),
    };
}

function carryGitleaks(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/')) throw new Error(`${path}: scoped secret allowlists require explicit conversion.`);
    const parsed = source.parsed;
    const single = asRaw(parsed['allowlist']);
    const entries = [...(single ? [single] : []), ...asList(parsed['allowlists'])];
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const description = asText(entry['description']) ?? '';
        appendSetting(lists, 'gitleaks', 'allow', [
            {
                description,
                paths: asStrings(entry['paths']),
                regexes: asStrings(entry['regexes']),
                ...targetKeys(entry),
                reason: description === '' ? reasonFor(path) : description,
            },
        ]);
    }
}

const strings = z.array(z.string());

const allowlist = z.strictObject({
    description: z.string().optional(),
    paths: strings.optional(),
    regexes: strings.optional(),
    regexTarget: z.string().optional(),
    condition: z.string().optional(),
});

export const gitleaksImporter = {
    schema: z.strictObject({
        allowlist: allowlist.optional(),
        allowlists: z.array(allowlist).optional(),
        extend: z.strictObject({ useDefault: z.literal(true) }).optional(),
    }),
    carry: carryGitleaks,
};
