---
title: Express
configurations: [express]
---

The `express` configuration adds ESLint rules for the code of an Express service. They report request data written into
the SQL text of a call, and values or stack traces in the error that a client gets. Its rules run in
`javascript/eslint`, before each commit. To check an OpenAPI description of the service, add the
[`openapi` configuration](/reference/configurations/openapi/).

## ESLint rules

The `gspot/restricted-syntax` rule reports these patterns at both levels:

| Pattern                                                                                                                 | Message                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `req.body`, `req.query`, or `req.params` in the template text of a `query`, `execute`, `raw`, or `$queryRawUnsafe` call | Request data goes into the SQL text of a database call, which allows SQL injection. Pass the value as a query parameter. |
| A template with values in the `message` or `error` field of an object passed to `.json()` or `.send()`                  | Keep values out of the message a client reads; send each value in its own field.                                         |
| A `stack` field set from an error's `stack` in `res.json()` or `res.send()`, also after `res.status()`                  | A stack trace in an API response leaks implementation details. Log it on the server, and return a generic message.       |

The `express` configuration also reports `methodOverride()` placed before the CSRF middleware, through
`security/detect-no-csrf-before-method-override`.

The rules of the `javascript` configuration also check Express code. `gspot/no-unchecked-request-data` follows request
data through the variables of a handler into a redirect, an HTML response, a file path, an outbound request, and SQL text
built in a variable. For example, this handler sends request data back as HTML:

```js title="src/server.js"
app.get('/hello', (req, res) => {
    const name = req.query.name;
    res.send(`<p>${name}</p>`);
});
```

```text
src/server.js:3:14  gspot/no-unchecked-request-data  The response returns request data as HTML, which allows reflected XSS. Escape the value, or send JSON.
```

The [Servers rules](/reference/eslint-plugin/servers/#no-unchecked-request-data) list the others, such as
`gspot/no-powered-by-header`.
