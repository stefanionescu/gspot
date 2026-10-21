import type { START_RUNNERS, PACKAGE_MANAGERS } from '#cli/config/repository/package-manager.ts';

/** The runner chosen from the gspot dependency of this repository. */
export type StartRunner = {
    name: keyof typeof START_RUNNERS;
    command: string;
    missing: string;
    installCommand: string;
};

export type PackageManager = { name: (typeof PACKAGE_MANAGERS)[number]; version: string };

/** A validated package manager name and its authored or detected version, when present. */
export type PackageManagerPin = { name: (typeof PACKAGE_MANAGERS)[number]; version?: string | undefined };

export type PackageManagerField = PackageManagerPin & { declared: string; field: string };
