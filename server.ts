import { createServer } from "node:http";
import { createApp } from "./server/_core/index";
import { serveStatic } from "./server/_core/static";

// Vercel recognizes this root server entrypoint and captures the listener as a
// Node.js Function. Static Vite files are built into /public and included via
// vercel.json; API, OAuth, and storage proxy routes remain on the same Express
// app so their existing paths and cookie behavior are preserved.
const app = createApp();
serveStatic(app);

const server = createServer(app);
server.listen(Number(process.env.PORT ?? 3000));
