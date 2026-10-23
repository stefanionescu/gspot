import { type START_RUNNERS, type PACKAGE_MANAGERS } from '#cli/config/repository/npm.ts';

export type StartRunner = {
    name: keyof typeof START_RUNNERS;
    command: string;
    missing: string;
    installCommand: string;
};

export type PackageManager = { name: (typeof PACKAGE_MANAGERS)[number]; version: string };

export type PackageManagerPin = { name: (typeof PACKAGE_MANAGERS)[number]; version?: string | undefined };

export type PackageManagerField = PackageManagerPin & { written: string; field: string };
