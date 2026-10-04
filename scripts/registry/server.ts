// Own the listen socket before reporting readiness to the parent release harness.
import { runServer } from 'verdaccio';
import type { Server } from 'node:http';
import { ARGUMENT_START } from '#automation/config/paths.ts';

const [config, port] = process.argv.slice(ARGUMENT_START);
if (config === undefined || config === '' || port === undefined || !process.send) {
    throw new Error('Start the registry through its parent harness.');
}
const server = (await runServer(config)) as Server;
process.once('disconnect', () => {
    server.closeAllConnections();
    server.close();
});
server.listen(Number(port), '127.0.0.1', () => {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Registry has no TCP address.');
    process.send?.({ port: address.port });
});
