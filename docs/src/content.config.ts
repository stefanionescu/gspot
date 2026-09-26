import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { referenceLoader } from './content/reference/loader.ts';

export const collections = { docs: defineCollection({ loader: referenceLoader(), schema: docsSchema() }) };
