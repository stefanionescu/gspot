import { z } from 'zod';

export const runnerSchema = z.strictObject({
    tool: z.enum(['mise', 'npm', 'bun', 'pnpm', 'yarn']).describe('The runner that installs and runs gspot.'),
});
