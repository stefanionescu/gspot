import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { referenceCollection } from './content/reference/collection.ts';

export const collections = { docs: defineCollection({ loader: referenceCollection(), schema: docsSchema() }) };
