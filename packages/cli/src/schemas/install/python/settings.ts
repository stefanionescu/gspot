import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PythonIndex, PythonIndexSettings, PythonProjectSettings } from '#cli/types/install/python.ts';

const uvIndexSchema = z.looseObject({ url: z.string() } satisfies SchemaShape<{ url: string }>);

export const uvSettingsSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

export const uvProjectSettingsSchema = z.object({
    tool: z
        .object({
            uv: uvSettingsSchema.default({}),
        } satisfies SchemaShape<
            { uv: PythonIndexSettings['settings'] },
            { uv?: PythonIndexSettings['settings'] | undefined }
        >)
        .default({ uv: {} }),
}) satisfies z.ZodType<PythonProjectSettings>;

export const uvIndexesSchema = z.array(uvIndexSchema) satisfies z.ZodType<PythonIndex[]>;

export const uvFindLinksSchema = z.array(z.string()) satisfies z.ZodType<string[]>;
