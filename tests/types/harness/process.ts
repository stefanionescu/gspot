/** The streams and termination controls owned by a test child process. */
export type CapturedProcess = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

/** Captured streams whose disposal stops and drains the owned child. */
export type CapturedChild = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };

/** The owned process and work directory recorded by a stalled registry boundary. */
export type PackageArchiveMarker = { pid: number; work: string };

/** A stalled Git boundary and the copy path it started. */
export type CopyMarker = { pid: number; checkout?: string };

/** A directory copy started by a copy acquisition. */
export type DirectoryCopyMarker = { destination: string };
