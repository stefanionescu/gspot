import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { buildDocsSource } from '#docs/reference/collection.ts';

export const collections = { docs: defineCollection({ loader: buildDocsSource(), schema: docsSchema() }) };
