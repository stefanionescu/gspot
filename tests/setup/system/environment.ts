// Changes environment variables for a scope and restores them when it ends.

import { mock } from 'bun:test';
import * as systemEnvironment from 'std-env';

/**
 * Sets or clears one environment variable for this process and the tools it spawns.
 *
 * @param name the key in process.env to set or remove.
 * @param value text to set, or undefined to clear.
 */
function setEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}

/**
 * Set environment variables for a test and restore them when the scope ends, even after a failure.
 *
 * @param variables values to set or clear for this scope.
 * @returns a resource that restores the old values.
 */
export function overrideEnvironment(variables: Record<string, string | undefined>): Disposable {
    const previous = Object.fromEntries(Object.keys(variables).map((name) => [name, process.env[name]]));
    for (const [name, value] of Object.entries(variables)) setEnvironmentVariable(name, value);
    return {
        [Symbol.dispose]() {
            for (const [name, value] of Object.entries(previous)) setEnvironmentVariable(name, value);
        },
    };
}

/** Make the terminal look interactive and not CI, until the returned resource gets disposed. */
export async function simulateInteractiveTerminal(): Promise<AsyncDisposable> {
    const resources = new AsyncDisposableStack();
    const previousEnvironment = { ...systemEnvironment };
    await mock.module('std-env', () => ({ ...previousEnvironment, isCI: false }));
    resources.defer(async () => {
        await mock.module('std-env', () => previousEnvironment);
    });
    for (const stream of [process.stdin, process.stdout]) {
        const descriptor = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        Object.defineProperty(stream, 'isTTY', { configurable: true, value: true });
        resources.defer(() => {
            if (descriptor === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', descriptor);
        });
    }
    return resources;
}
