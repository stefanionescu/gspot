/** The real Git executable and the call a cancellation probe must pause. */
export type FakeGitOptions = {
    operation: 'diff' | 'clone' | 'cat-file';
    marker: string;
    pauseOnCall: number;
    executable: string;
};

/** A stalled Git boundary and the copy path it started. */
export type CopyMarker = { pid: number; checkout?: string };
