import { z } from 'zod';

const localizableStringSchema = z.object({
    shouldTranslate: z.boolean().optional(),
    localizations: z.record(z.string(), z.unknown()).optional(),
});

export const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z.record(z.string(), localizableStringSchema).optional(),
});

export const assetContentsSchema = z.object({
    images: z.object({ filename: z.string().optional() }).array().optional(),
});
