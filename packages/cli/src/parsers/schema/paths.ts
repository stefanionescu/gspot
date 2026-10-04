import { z } from 'zod';

export const relativePath = z
    .string()
    .min(1)
    .regex(
        /^(?!\/)(?![\s\S]*(?:^|\/)\.\.(?:\/|$))[^\\:\p{Cc}]+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );
