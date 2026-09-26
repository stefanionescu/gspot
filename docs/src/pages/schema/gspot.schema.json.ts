import { policyJsonSchemaText } from '@gspot/cli/src/policy/json-schema.ts';

/**
 * Serves the policy JSON Schema at /schema/gspot.schema.json.
 * @returns the schema response
 */
export function GET(): Response {
    return new Response(policyJsonSchemaText(), { headers: { 'Content-Type': 'application/schema+json' } });
}
