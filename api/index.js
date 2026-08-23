import app from "../dist/index.js";

// Vercel discovers Node.js functions only under /api. The compiled server
// bundle preserves the existing Express, tRPC, OAuth, and storage routes.
export default app;
