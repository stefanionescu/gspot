import { z } from 'zod';

export const tsconfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
});
