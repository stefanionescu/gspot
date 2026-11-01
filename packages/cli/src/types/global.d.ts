import 'zod/v4/core';
import type { PATH_ROLES } from '#cli/config/manifests.ts';

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Only an interface merges into the global RegExpConstructor; a type alias cannot.
    interface RegExpConstructor {
        escape(text: string): string;
    }
}

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

declare module 'zod/v4/core' {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Only an interface merges into the GlobalMeta of zod; a type alias cannot.
    interface GlobalMeta {
        path_role?: (typeof PATH_ROLES)[number];
    }
}
