// The types of platform/root in this package.
import type { Read, Bounds } from '#cli/types/platform/platform.ts';

export type Staging = { bounds: Bounds; path: string; target: string; temporary: string };

export type Proposed = ReadonlyMap<string, Read | undefined>;
