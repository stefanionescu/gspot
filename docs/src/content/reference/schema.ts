import { z } from 'zod';
import { policySchema } from '@gspothq/cli/src/policy/schema/policy.ts';
import { JSON_SCHEMA_URL } from '@gspothq/cli/src/config/commands/init.ts';
import { localDateSchema, calendarDateSchema } from '@gspothq/cli/src/policy/schema/fields.ts';

/**
 * Project the runtime policy validator into the editor's JSON representation.
 * @returns the published schema, with native TOML dates represented as calendar strings
 */
export function buildJsonSchema(): Record<string, unknown> {
    const schema = z.toJSONSchema(policySchema, {
        io: 'input',
        unrepresentable: ({ zodSchema }) =>
            zodSchema === localDateSchema ? z.toJSONSchema(calendarDateSchema) : 'throw',
    });
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: JSON_SCHEMA_URL,
        title: 'gspot.toml',
        description: 'The settings of gspot for one repository in the latest release.',
        ...schema,
    };
}
