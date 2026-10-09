import type { ConsumerOptions } from '#tests/types/harness/consumer.ts';

/** An authored formatter repository and the options of its installed CLI commands. */
export type FormatterConsumer = { toolConsumer: string; toolOptions: ConsumerOptions; authoredPackage: string };

/** An authored native-tool repository and the options of its installed CLI commands. */
export type NativeConsumer = { nativeConsumer: string; nativeOptions: ConsumerOptions; authoredPackage: string };
