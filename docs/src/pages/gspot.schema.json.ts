import type { APIRoute } from 'astro';
import { CLI_REFERENCE } from '#cli/reference.ts';

/**
Serve the settings schema during development and prerender it for production.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Astro serves this endpoint only through an exported handler named for the HTTP method.
export const GET: APIRoute = () => Response.json(CLI_REFERENCE.schema);
