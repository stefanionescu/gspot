import type { z } from 'zod';
import type { run } from '#cli/platform/public.ts';
import type { packedPackagesSchema } from '#tests/harness/registry.ts';

/** Execute install commands within the caller's cancellation boundary. */
export type RegistryCommand = typeof run;

/** Package metadata and its local source to pack for installation. */
export type RegistryPackage = {
    name: string;
    source: string;
    version: string;
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

/** A packed package transferred from the suite runner to its installation tests. */
export type PackedRegistryPackage = z.infer<typeof packedPackagesSchema>[number];

/** Locally served package bytes, optionally protected by a credential. */
export type PackageRegistry = AsyncDisposable & { url: string; readonly requests: number };

/** A wheel served from an authenticated local Python package index. */
export type PythonRegistry = AsyncDisposable & { version: string; url: string };

/** The temporary npm settings owned by one generated tool-project installation. */
export type InstallationRegistry = AsyncDisposable & { environment: Record<string, string> };

/** The extra packages and optional authentication required by an installation scenario. */
export type PackageRegistryOptions = { declarations: RegistryPackage[]; execute: RegistryCommand; token?: string };
