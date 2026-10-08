import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

/*
  Change this file according to your needs.
*/
const title = "Hello Hono!";
const message = "Start editing src/index.ts to see your changes.";

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>${title}</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 32px;

          background: white;
          color: black;

          font-family: Arial, sans-serif;
        "
      >
        <h1>${title}</h1>

        <p>${message}</p>
      </body>
    </html>
  `);
});

const port = 3000;

console.log(
  `Server is running on http://localhost:${port}`,
);

serve({
  fetch: app.fetch,
  port,
});