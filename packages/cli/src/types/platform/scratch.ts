/** A temporary folder that removes itself when disposed. */
export type ScratchFolder = Disposable & { path: string };
