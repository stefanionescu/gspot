/** One syntax token in the home-page code example. */
export type ExampleToken = { text: string; kind: string };
/** One numbered source line in the home-page code example. */
export type ExampleLine = { number: number; tokens: ExampleToken[] };
