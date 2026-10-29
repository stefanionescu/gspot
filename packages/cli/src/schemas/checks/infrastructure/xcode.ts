import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { XcodeStrings, AssetContents } from '#cli/types/checks/infrastructure/xcode.ts';

const localizableStringSchema = z.object({
    shouldTranslate: z.boolean().optional(),
    localizations: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<NonNullable<XcodeStrings['strings']>[string]>);

export const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z.record(z.string(), localizableStringSchema).optional(),
} satisfies SchemaShape<XcodeStrings>);

export const assetContentsSchema = z.object({
    images: z
        .object({ filename: z.string().optional() } satisfies SchemaShape<NonNullable<AssetContents['images']>[number]>)
        .array()
        .optional(),
} satisfies SchemaShape<AssetContents>);
