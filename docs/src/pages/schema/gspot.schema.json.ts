import type { APIRoute } from 'astro';
import { policyJsonSchema } from '@gspot/cli/src/policy/json-schema.ts';
import { PACKAGE_JSON_INDENT } from '@gspot/cli/src/constants/generation.ts';

/**
 * Serves the policy JSON Schema at `/schema/gspot.schema.json`.
 * @returns the schema response
 */
export const GET: APIRoute = () => {
    return new Response(`${JSON.stringify(policyJsonSchema(), null, PACKAGE_JSON_INDENT)}\n`, {
        headers: { 'Content-Type': 'application/schema+json' },
    });
};
