import type { ActionPin } from '#cli/types/generation/ci.ts';

export type RegistryPin = { tool: string; installer: string; name: string; version: string; url: string };

export type SharedPin = Pick<ActionPin, 'name' | 'version'> & Partial<Pick<ActionPin, 'sha'>>;
