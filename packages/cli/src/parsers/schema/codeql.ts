import { z } from 'zod';

/** CodeQL resolve-languages metadata for selecting one extractor and query pack per language. */
export const codeqlLanguagesSchema = z.object({
    aliases: z.record(z.string(), z.string()),
    extractors: z.record(z.string(), z.array(z.unknown())),
});
