import type { z } from 'zod';
import type { releaseDocumentSchema } from '#automation/parsers/releases.ts';

export type ReleaseDocument = z.infer<typeof releaseDocumentSchema>;

export type RegistryPin = { tool: string; installer: string; name: string; version: string; url: string };
