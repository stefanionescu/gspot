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
/** An installer could not make the already validated, locked tools available. */
export class InstallationError extends Error {
    /**
     *
     * @param message
     */
    constructor(message: string) {
        super(message);
        this.name = 'InstallationError';
    }
}
