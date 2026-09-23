import { z } from 'zod';
import { formatRequest, prettierIgnoreRequest } from './format-evaluation.ts';
import { eslintRequest, eslintCoverageRequest } from './eslint-evaluation.ts';
import { licenseRequest } from './license-evaluation.ts';
import { stylelintRequest } from './stylelint-evaluation.ts';
import { eslintPreviewRequest } from './eslint-preview.ts';

export const configurationRequest = z.discriminatedUnion('operation', [
    eslintPreviewRequest.extend({ tool: z.literal('eslint'), operation: z.literal('preview-rules') }),
    stylelintRequest.extend({ tool: z.literal('stylelint'), operation: z.literal('stylelint') }),
    licenseRequest.extend({ tool: z.literal('license-checker-rseidelsohn'), operation: z.literal('licenses') }),
    formatRequest.extend({ tool: z.literal('prettier'), operation: z.literal('format') }),
    eslintRequest.extend({ tool: z.literal('eslint'), operation: z.literal('rules') }),
    eslintCoverageRequest.extend({ tool: z.literal('eslint'), operation: z.literal('coverage') }),
    prettierIgnoreRequest.extend({ tool: z.literal('prettier'), operation: z.literal('ignore') }),
]);
