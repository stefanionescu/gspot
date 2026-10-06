import { z } from 'zod';
import { reasoned } from '#cli/policy/schema/fields.ts';
import { licenseSettingsSchema } from '#cli/policy/schema/tools.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const anyTable = z.record(z.string(), z.unknown());

/** Authored environment template and reader declarations. */
export const environmentSettingsSchema = z.strictObject({
    templates: reasoned(z.array(z.string().min(1))).optional(),
    reader_functions: reasoned(z.array(z.string().min(1))).optional(),
});

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
    ].map((name) => {
        const ownedNamespaces = { licenses: licenseSettingsSchema, env: environmentSettingsSchema };
        const schema = Object.hasOwn(ownedNamespaces, name)
            ? ownedNamespaces[name as keyof typeof ownedNamespaces]
            : anyTable;
        return [name, schema.optional()];
    }),
);
