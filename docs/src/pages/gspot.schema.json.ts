import type { APIRoute } from 'astro';
import { CLI_REFERENCE } from '@gspothq/cli/reference';

export const GET: APIRoute = () => Response.json(CLI_REFERENCE.schema);
