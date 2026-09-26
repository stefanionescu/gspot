// The types of tools in this package.
import type { ToolPin } from '#cli/types/configurations.ts';
import type { PolicyFiles } from '#cli/types/policy/policy.ts';

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';
export type Inspected = { root: string; cwd: string; tool: ToolPin; path: string; hint: string };
export type VersionObservation = { version: string } | { state: 'missing' | 'error'; note: string };
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
/** The two facts of a package.json that say which package it is. */
export type PackageFacts = { name?: string; version?: string };
export type PrivateKind = 'npm' | 'python';
