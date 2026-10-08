import type { z } from 'zod';
import type { settingNamespaceSchemas } from '#cli/policy/schema/namespaces.ts';
import type { activeSettingNamespacesSchema } from '#cli/policy/schema/active-settings.ts';

/** Namespace identities come from the same compiler output as their validators. */
export type SettingNamespace = keyof typeof settingNamespaceSchemas;

/** Default-bearing fields are required only where the real provider graph guarantees them. */
export type ActiveSettingNamespaces = z.output<typeof activeSettingNamespacesSchema>;

/** A namespace's keys retain the types declared by its actual configuration. */
export type SettingOptions<Name extends SettingNamespace> = NonNullable<ActiveSettingNamespaces[Name]>;

/** Runtime validation and its literal compiler output share one construction. */
export type CompiledSetting<Schema extends z.ZodType = z.ZodType> = {
    schema: Schema;
    expression: string;
};
