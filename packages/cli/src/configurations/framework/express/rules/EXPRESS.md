# Express

Read this rule when you change routes, middleware, or error handling in an Express service.

Read HTTP.md too.

## Routes and middleware

Validate requests with the schemas the project already has, in middleware, and give each route one domain call.

- Declare each field that middleware sets on `response.locals` in the global `Express.Locals` interface in a `.d.ts`
  file, so a route reads typed values.

- Middleware checks authentication and ownership, and reaches the database only through the auth helpers.
- A permission check that depends on domain state belongs in a module, and a transport-level one in ownership
  middleware.

## Errors

- Express 5 forwards a rejected promise that a route or middleware returns, so return it and add no wrapper that repeats
  this. Express 4 needs the project's async handler or an explicit `next(error)`.
- Callback-based asynchronous work passes its errors to `next(error)` in both versions.
- Error middleware keeps its four-argument signature, even when the function does not use an argument.
- After the headers go out, error middleware calls `next(error)` instead of writing a second response.
- The not-found handler comes after every route.
