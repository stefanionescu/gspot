import type { AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

/** The working directory, environment, and limit owned by an installed-consumer command. */
export type ConsumerOptions = Required<Pick<AsyncSpawnOptions, 'cwd' | 'env'>>;

/** A fresh consumer of the release: its install, its folder, the command that runs gspot, and the options it runs with. */
export type Consumer = {
    root: string;
    command: string[];
    /** Check commands cannot reach the network. */
    offlineOptions: ConsumerOptions;
    /** Acquisition commands can reach the isolated registry and its upstream. */
    onlineOptions: ConsumerOptions;
    workspace: string;
    [Symbol.asyncDispose]: () => Promise<void>;
};
