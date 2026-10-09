import type { ToolPin } from '#cli/types/parsers/tool.ts';

/** The repository and generated Yarn settings used during package lockfile resolution. */
export type PackagePreparation = { root: string; yarn: string | undefined };
/** The repository and declared native wrappers verified before installing the package project. */
export type PackageInstallation = { root: string; tools: Iterable<ToolPin> };

/** The isolated execution and credential-free native lockfile output. */
export type PackageRun = { env: Record<string, string>; lockfile: string };

/** Native package operations for a declared manager major. */
export type PackageCommands = { lockfile: string[]; install: string[] };
