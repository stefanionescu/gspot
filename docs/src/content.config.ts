import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { referenceLoader } from './content/reference';

export const collections = { docs: defineCollection({ loader: referenceLoader(), schema: docsSchema() }) };
