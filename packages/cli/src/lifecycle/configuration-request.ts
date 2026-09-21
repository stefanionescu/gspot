import { z } from 'zod';
import { formatRequest, prettierIgnoreRequest } from './format-request.ts';
import { eslintRequest } from './eslint-request.ts';

export const configurationRequest = z.discriminatedUnion('operation', [
    formatRequest.extend({ tool: z.literal('prettier'), operation: z.literal('format') }),
    eslintRequest.extend({ tool: z.literal('eslint'), operation: z.literal('rules') }),
    prettierIgnoreRequest.extend({ tool: z.literal('prettier'), operation: z.literal('ignore') }),
]);
