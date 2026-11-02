declare module '@npmcli/config' {
    /** The npm settings of a folder, in layers. */
    export default class Config {
        /** Prepare the reader. */
        constructor(options: Record<string, unknown>);
        list: Record<string, unknown>[];
        /** Read each settings layer. */
        load(): Promise<void>;
        /** Test the settings of every layer. */
        validate(): boolean;
    }
}

declare module '@npmcli/config/lib/definitions/index.js' {
    const npmDefinitions: Record<'definitions' | 'flatten' | 'shorthands', unknown>;
    export default npmDefinitions;
}
