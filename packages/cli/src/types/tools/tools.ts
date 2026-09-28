// The types of tools in this package.
import type { ToolPin, Manifest } from '#cli/types/kits.ts';
import type { PolicyFiles } from '#cli/types/policy/policy.ts';
import type { Session } from '#cli/types/execution/execution.ts';

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';
export type Inspected = { root: string; cwd: string; tool: ToolPin; path: string; hint: string };
export type VersionRead = { version: string } | { state: 'missing' | 'error'; note: string };
export type ToolInspection = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    note?: string;
    floor?: string;
};
export type ToolContext = {
    root: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    policyFiles?: PolicyFiles;
};
/** The two fields of a package.json that say which package it is. */
export type Package = { name?: string; version?: string };
export type PrivateKind = 'npm' | 'python';

/** One independently attempted installation phase and its non-Error failure text. */
export type InstallationStep = {
    failure: string;
    run: (session: Session, manifests: Manifest[]) => string | Promise<string>;
};
