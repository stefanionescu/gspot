import { CLI_REFERENCE } from '@gspothq/cli/reference';
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => Response.json(CLI_REFERENCE.schema);
