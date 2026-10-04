import { z } from 'zod';
import { licenseSettingsSchema } from '#cli/policy/schema/tools.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const anyTable = z.record(z.string(), z.unknown());

/** Configuration behavior namespaces declared by the configuration manifests. */
export const configurationSettingSchemas = Object.fromEntries(
    [
        ...new Set(
            [...configurationManifests().values()].flatMap((manifest) =>
                manifest.settings
                    .map((setting) => setting.name.replace(/\..*/u, ''))
                    .filter(
                        (name) =>
                            !['tools', 'limits', 'naming', 'format', 'structure', 'architecture', 'prose'].includes(
                                name,
                            ),
                    ),
            ),
        ),
    ].map((name) => [name, (name === 'licenses' ? licenseSettingsSchema : anyTable).optional()]),
);
