import { type START_RUNNERS, type PACKAGE_MANAGERS } from '#cli/config/repository/npm.ts';

/** The runner chosen from the gspot dependency of this repository. */
export type StartRunner = {
    name: keyof typeof START_RUNNERS;
    command: string;
    missing: string;
    installCommand: string;
};

export type PackageManager = { name: (typeof PACKAGE_MANAGERS)[number]; version: string };

/** A validated package manager name and its version as written or detected, when present. */
export type PackageManagerPin = { name: (typeof PACKAGE_MANAGERS)[number]; version?: string | undefined };

export type PackageManagerField = PackageManagerPin & { written: string; field: string };
