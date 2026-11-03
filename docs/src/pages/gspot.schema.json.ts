import type { APIRoute } from 'astro';
import { CLI_REFERENCE } from '#cli/reference.ts';

/**
Serve the settings schema during development and prerender it for production.
*/
export const GET: APIRoute = () => Response.json(CLI_REFERENCE.schema);
