import type { APIRoute } from 'astro';
import { policyJsonSchema } from 'gspot/src/policy/json-schema.ts';
import { PACKAGE_JSON_INDENT } from 'gspot/src/config/generation.ts';

/**
 * Serves the policy JSON Schema at `/schema/gspot.schema.json`.
 * @returns the schema response
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Serves the policy JSON Schema at `/schema/gspot.schema.json`. 0 files make 0 calls; one owner keeps that behavior in one place.
export const GET: APIRoute = () => {
    return new Response(`${JSON.stringify(policyJsonSchema(), null, PACKAGE_JSON_INDENT)}\n`, {
        headers: { 'Content-Type': 'application/schema+json' },
    });
};
