import { z } from 'zod';
import { reasoned } from '#cli/policy/schema/fields.ts';
import { valueAt, isRecord } from '#cli/platform/objects.ts';
import { licenseSettingsSchema } from '#cli/policy/schema/tools.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const settings = [...configurationManifests().values()].flatMap((manifest) => manifest.settings);

const reasonedValueSchema = z.strictObject({ value: z.unknown(), reason: z.string().optional() });

/** Authored environment template and reader declarations. */
export const environmentSettingsSchema = z.strictObject({
    templates: reasoned(z.array(z.string().min(1))).optional(),
    reader_functions: reasoned(z.array(z.string().min(1))).optional(),
});

/** Configuration behavior namespaces declared by the configuration manifests. */
export const configurationSettingSchemas = Object.fromEntries(
    [
        ...new Set(
            settings
                .map((setting) => setting.name.replace(/\..*/u, ''))
                .filter(
                    (name) =>
                        !['tools', 'limits', 'naming', 'format', 'structure', 'architecture', 'prose'].includes(name),
                ),
        ),
    ].map((name) => {
        const namespaceSettings = settings.filter((setting) => setting.name.startsWith(`${name}.`));
        const ownedNamespaces = { licenses: licenseSettingsSchema, env: environmentSettingsSchema };
        const schema = Object.hasOwn(ownedNamespaces, name)
            ? ownedNamespaces[name as keyof typeof ownedNamespaces]
            : z.record(z.string(), z.unknown()).superRefine((table, context) => {
                  // Value constraints remain recoverable findings; wrapper shapes must validate before normalization.
                  for (const setting of namespaceSettings) {
                      const path = setting.name.split('.').slice(1);
                      const value = valueAt(table, path);
                      if (
                          !isRecord(value) ||
                          !('value' in value) ||
                          !Object.keys(value).every((key) => key === 'value' || key === 'reason')
                      )
                          continue;
                      const result = reasonedValueSchema.safeParse(value);
                      if (!result.success)
                          for (const issue of result.error.issues)
                              context.addIssue({ ...issue, path: [...path, ...issue.path] });
                  }
              });
        return [name, schema.optional()];
    }),
);
