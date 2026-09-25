import { configurationManifests } from '#cli/configurations/manifests.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import { licenseResponse } from '#cli/evaluation/protocol.ts';
import { appendSetting, reasonFor, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { asList, asStrings } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { posix } from 'node:path';
import parseLicense from 'spdx-expression-parse';
import { z } from 'zod';

const strings = z.array(z.string());

function namesOf(value: unknown): string[] {
    const items = typeof value === 'string' ? value.split(';') : asStrings(value);
    return items.map((item) => item.trim()).filter((item) => item !== '');
}

async function carryLicenses(
    source: CarrySource,
    path: string,
    lists: CarriedConfiguration,
    root: string,
): Promise<void> {
    const parsed = source.parsed;
    const allowed = namesOf(parsed['onlyAllow']);
    const defaults = z.array(z.string()).parse(
        configurationManifests()
            .get('licenses')
            ?.settings.find((setting) => setting.name === 'tools.licenses.licenses_allowed')?.default,
    );
    if (allowed.length > 0 && defaults.some((license) => !allowed.includes(license)))
        throw new Error(
            `${path}: the license allowlist is narrower than the shipped policy and requires explicit conversion.`,
        );
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
    const excluded = namesOf(parsed['excludePackages']);
    const settings: TomlTable = {};
    if (excluded.length > 0) {
        const entries = licenseResponse.parse(
            await evaluateConfiguration({
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
        const scope = lists.scopes.get(base) ?? { configurations: [], tools: {} };
        scope.configurations = [...new Set([...scope.configurations, 'licenses'])];
        scope.tools['licenses'] = settings;
        lists.scopes.set(base, scope);
    }
}

export const licensesImporter = {
    schema: z.strictObject({
        excludePackages: z.union([z.string(), strings]).optional(),
        onlyAllow: z.union([z.string(), strings]).optional(),
    }),
    carry: carryLicenses,
};
