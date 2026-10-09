import { policySchema } from '@gspothq/cli/src/policy/schema/public.ts';
import { JSON_SCHEMA_URL } from '@gspothq/cli/src/config/commands/init.ts';
import { policyJsonSchema } from '@gspothq/cli/src/policy/schema/contracts.ts';

/**
 * Project the runtime policy validator into the editor's JSON representation.
 * @returns the published schema, with native TOML dates represented as calendar strings
 */
export function buildJsonSchema(): Record<string, unknown> {
    const schema = policyJsonSchema(policySchema);
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: JSON_SCHEMA_URL,
        title: 'gspot.toml',
        description: 'The settings of gspot for one repository in the latest release.',
        ...schema,
    };
}
