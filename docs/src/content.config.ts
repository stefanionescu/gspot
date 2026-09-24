import { defineCollection } from 'astro:content';
import { referenceLoader } from './content/reference';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = { docs: defineCollection({ loader: referenceLoader(), schema: docsSchema() }) };
