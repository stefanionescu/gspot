import type { APIRoute } from 'astro';
import { REFERENCE_JSON_INDENT } from '../../config/reference.ts';
import { buildJsonSchema } from '../../content/reference/schema.ts';

/**
 * Serves the policy JSON Schema at `/schema/gspot.schema.json`.
 * @returns the schema response
 */
export const GET: APIRoute = () => {
    return new Response(`${JSON.stringify(buildJsonSchema(), null, REFERENCE_JSON_INDENT)}\n`, {
        headers: { 'Content-Type': 'application/schema+json' },
    });
};
