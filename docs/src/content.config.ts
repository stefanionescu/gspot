import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { buildReferenceCollection } from './reference/collection.ts';

export const collections = { docs: defineCollection({ loader: buildReferenceCollection(), schema: docsSchema() }) };
