import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { createDocsSource } from './reference/collection.ts';

export const collections = { docs: defineCollection({ loader: createDocsSource(), schema: docsSchema() }) };
