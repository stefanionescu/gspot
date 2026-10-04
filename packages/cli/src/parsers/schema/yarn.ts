// Native Yarn settings are validated before connection values reach an isolated install.
import { z } from 'zod';

export const yarnConnectionSettingsSchema = z.record(z.string(), z.unknown());

export const yarnConfigEntrySchema = z.object({ key: z.string() });

export const yarnSettingSchema = z.json();
