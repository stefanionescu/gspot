import type { APIRoute } from 'astro';
import { LLMS_TEXT } from '#docs/guides/setup.ts';

export const GET: APIRoute = () => new Response(LLMS_TEXT);
