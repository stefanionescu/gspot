import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { XcodeStrings, AssetContents } from '#cli/types/checks/xcode.ts';

/** A string catalog: its source language and translations. */
export const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z
        .record(
            z.string(),
            z.object({
                shouldTranslate: z.boolean().optional(),
                localizations: z.record(z.string(), z.unknown()).optional(),
            } satisfies SchemaShape<NonNullable<XcodeStrings['strings']>[string]>),
        )
        .optional(),
} satisfies SchemaShape<XcodeStrings>) satisfies z.ZodType<XcodeStrings>;

/** The image files that an asset catalog Contents.json names. */
export const assetContentsSchema = z.object({
    images: z
        .array(
            z.object({ filename: z.string().optional() } satisfies SchemaShape<
                NonNullable<AssetContents['images']>[number]
            >),
        )
        .optional(),
} satisfies SchemaShape<AssetContents>) satisfies z.ZodType<AssetContents>;
