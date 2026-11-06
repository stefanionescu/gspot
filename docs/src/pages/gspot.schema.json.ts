import type { APIRoute } from 'astro';

import { CLI_REFERENCE } from '#cli/reference.ts';

export const GET: APIRoute = () => Response.json(CLI_REFERENCE.schema);
