import { z } from 'zod';
import { posix } from 'node:path';
import parseLicense from 'spdx-expression-parse';
import { licenseResponse } from '#cli/native/protocol.ts';
import { runConfiguration } from '#cli/native/configuration.ts';
import { asList, asStrings } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import type { AdoptionResult, ConfigurationSource } from '#cli/types/policy/adoption.ts';
import { reasonFor, adoptedScope, appendSetting } from '#cli/policy/adoption/results.ts';

const strings = z.array(z.string());

function namesOf(value: unknown): string[] {
    const items = typeof value === 'string' ? value.split(';') : asStrings(value);
    return items.map((item) => item.trim()).filter((item) => item !== '');
}

// Compound expressions cannot become individual SPDX allowances without changing their meaning.
function validateAllowances(allowed: string[], path: string): void {
    for (const license of allowed) {
        try {
            const parsed = parseLicense(license);
            if (typeof parsed !== 'object' || parsed === null || !('license' in parsed))
                throw new Error('Compound approved licenses require explicit conversion.');
        } catch (error) {
            throw new Error(
                `${path}: license allowance ${JSON.stringify(license)} cannot be represented as one approved SPDX license.`,
                { cause: error },
            );
        }
    }
}

async function carryLicenses(
    source: ConfigurationSource,
    path: string,
    lists: AdoptionResult,
    root: string,
): Promise<void> {
    const parsed = source.parsed;
    const allowed = namesOf(parsed['onlyAllow']);
    validateAllowances(allowed, path);
    const excluded = namesOf(parsed['excludePackages']);
    const settings: TomlTable = {};
    if (excluded.length > 0) {
        const entries = licenseResponse.parse(
            await runConfiguration({
                root,
                from: path,
                exclusions: excluded,
                tool: 'license-checker-rseidelsohn',
                operation: 'licenses',
            }),
        );
        settings['packages_allowed'] = entries.map((entry) => ({ ...entry, reason: reasonFor(path) }));
    }
    if (allowed.length > 0) settings['licenses_allowed'] = allowed;
    const base = posix.dirname(path);
    if (base === '.') {
        for (const [key, values] of Object.entries(settings)) appendSetting(lists, 'licenses', key, asList(values));
    } else {
        const scope = adoptedScope(lists, base, 'licenses');
        scope.tools['licenses'] = settings;
    }
}

export const licensesImporter = {
    schema: z.strictObject({
        excludePackages: z.union([z.string(), strings]).optional(),
        onlyAllow: z.union([z.string(), strings]).optional(),
    }),
    keep: carryLicenses,
};
