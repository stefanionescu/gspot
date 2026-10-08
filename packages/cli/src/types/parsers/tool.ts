import type { z } from 'zod';
import type { toolSchema, installerPinSchema } from '#cli/parsers/schema/public.ts';

export type InstallerPin = z.output<typeof installerPinSchema>;

/** Resolved tool metadata derives from the validated manifest; installer declarations become named pins. */
export type ToolPin = z.output<typeof toolSchema>;

/** The classified version or failure of a completed version command. */
export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };
