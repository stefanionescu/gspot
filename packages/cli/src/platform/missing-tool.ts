// A check that needs a command nobody installed did not break: it never started. The runner reports it as missing.

/** Thrown by an analysis when the command it runs is not installed. */
export class MissingToolError extends Error {
    /**
     * Names the command that is absent.
     * @param text what is missing and, where the analysis knows it, how to install it
     */
    constructor(text: string) {
        super(text);
        this.name = 'MissingToolError';
    }
}
