import { policyJsonSchemaText } from '@gspot/cli/src/policy/json-schema.ts';

export function GET(): Response {
    return new Response(policyJsonSchemaText(), { headers: { 'Content-Type': 'application/schema+json' } });
}
