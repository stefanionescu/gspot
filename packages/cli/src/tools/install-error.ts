/** An installer could not make the already validated, locked tools available. */
export class InstallationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InstallationError';
    }
}
