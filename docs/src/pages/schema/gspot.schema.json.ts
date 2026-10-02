import type { APIRoute } from 'astro';
import { buildJsonSchema } from '@gspothq/cli/src/policy/json-schema.ts';
import { PACKAGE_JSON_INDENT } from '@gspothq/cli/src/config/generation/generation.ts';

/**
 * Serves the policy JSON Schema at `/schema/gspot.schema.json`.
 * @returns the schema response
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Astro serves the policy schema route through this exported GET handler.
export const GET: APIRoute = () => {
    return new Response(`${JSON.stringify(buildJsonSchema(), null, PACKAGE_JSON_INDENT)}\n`, {
        headers: { 'Content-Type': 'application/schema+json' },
    });
};
