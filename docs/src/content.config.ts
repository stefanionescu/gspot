// The docs collection Starlight reads: every page under src/content/docs.
import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { docsLoader } from '@astrojs/starlight/loaders';

export const collections = {
    docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
