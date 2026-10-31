import type { z } from 'zod';
import type { START_RUNNERS } from '#cli/config/repository/javascript.ts';
import type { packageManagerSchema, packageManagerPinSchema } from '#cli/schemas/repository/javascript.ts';

export type InstalledDependency = { path: string; version: string | undefined };

export type StartRunner = {
    name: keyof typeof START_RUNNERS;
    command: string;
    missing: string;
    installCommand: string;
};

export type PackageManager = z.infer<typeof packageManagerSchema>;

export type PackageManagerPin = z.infer<typeof packageManagerPinSchema>;

export type PackageManagerField = PackageManagerPin & { written: string; field: string };

export type PackageManagerCommand = { name: string; version?: string | undefined };
