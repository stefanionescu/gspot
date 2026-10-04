// Resource and command contracts for isolated package registries.
import type { run } from '#cli/platform/spawn.ts';

/** Execute acquisition commands within the caller's timeout and cancellation boundary. */
export type RegistryCommand = typeof run;

/** A local npm registry the release tests publish into. */
export type Registry = {
    url: string;
    npmrc: string;
    work: string;
    assertRunning: () => void;
    stop: () => Promise<void>;
};

/** Startup controls for an isolated registry listening on an automatically assigned port. */
export type RegistryStartOptions = { startupMs?: number; signal?: AbortSignal };

/** The readiness, output, and cleanup of one owned registry child. */
export type RegistryProcess = {
    ready: Promise<string>;
    output: Promise<[string, string]>;
    server: Bun.Subprocess<'ignore', 'pipe', 'pipe'>;
    stop: () => Promise<void>;
};

/** An actual package archived for the authenticated package-manager fixture. */
export type RegistryPackage = { name: string; source: string; version: string; bin: Record<string, string> };

/** A registry package with its packed bytes and npm integrity digest. */
export type PackedRegistryPackage = RegistryPackage & { archive: Buffer; integrity: string };

/** Authenticated package bytes served for installation tests. */
export type PackageRegistry = {
    token: string;
    url: string;
    readonly requests: number;
    [Symbol.asyncDispose](): Promise<void>;
};

/** A wheel served from an authenticated local Python package index. */
export type PythonRegistry = AsyncDisposable & { version: string; url: string };
