import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { InstallRecord } from '#cli/types/installers/record.ts';

export const installRecordSchema = z.strictObject({
    npm: z.hash('sha256').optional(),
    vale: z.hash('sha256').optional(),
} satisfies SchemaShape<InstallRecord>);
