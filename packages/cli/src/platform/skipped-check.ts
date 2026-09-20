/** A prerequisite prevents this check from running. */
export class SkippedCheckError extends Error {
    /**
     * Names the prerequisite that did not complete.
     * @param text the reason the check cannot run
     */
    constructor(text: string) {
        super(text);
        this.name = 'SkippedCheckError';
    }
}
