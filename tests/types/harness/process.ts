/** The streams and termination controls owned by a test child process. */
export type CapturedProcess = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

/** Captured streams whose disposal stops and drains the owned child. */
export type CapturedChild = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };
