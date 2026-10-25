import { pathToFileURL } from 'node:url';

const [version = '', bin = '', ...cliArguments] = process.argv.slice(2);
Object.defineProperty(process, 'versions', { value: { node: version } });
process.argv = ['node', 'gspot', ...cliArguments];
await import(pathToFileURL(bin).href);
