import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PythonIndex, PythonIndexSettings, PythonProjectSettings } from '#cli/types/installers/pypi.ts';

const uvIndexSchema = z.looseObject({ url: z.string() } satisfies SchemaShape<Pick<PythonIndex, 'url'>>);

export const uvSettingsSchema = z.looseObject({
    'find-links': z.string().array().optional(),
    index: uvIndexSchema.array().optional(),
} satisfies SchemaShape<Pick<PythonIndexSettings['settings'], 'find-links' | 'index'>>);

export const uvProjectSettingsSchema = z.object({
    tool: z
        .object({
            uv: uvSettingsSchema.default({}),
        } satisfies SchemaShape<
            { uv: PythonIndexSettings['settings'] },
            { uv?: PythonIndexSettings['settings'] | undefined }
        >)
        .default({ uv: {} }),
} satisfies SchemaShape<PythonProjectSettings>);
