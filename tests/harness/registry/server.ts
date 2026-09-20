// Own the listen socket before reporting readiness to the parent release harness.
import { runServer } from 'verdaccio';
import type { Server } from 'node:http';

const [config, port] = process.argv.slice(2);
if (config === undefined || config === '' || port === undefined || !process.send) {
    throw new Error('Start the registry through its parent harness.');
}
const server = (await runServer(config)) as Server;
server.listen(Number(port), '127.0.0.1', () => {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Registry has no TCP address.');
    process.send?.({ port: address.port });
});
