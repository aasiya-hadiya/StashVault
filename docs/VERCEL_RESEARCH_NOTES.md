# Vercel deployment research notes

These notes record the external deployment facts used for the StashVault Vercel adapter on 2026-08-23.

- Vercel's Vite guidance explains that a Vite SPA needs an explicit rewrite to `index.html` for deep links. It also distinguishes static Vite output from server-side Functions. Source: <https://vercel.com/docs/frameworks/frontend/vite>.
- Vercel documents rewrites in root-level `vercel.json`; rewrites preserve the visible browser URL while routing a request to an internal destination. Source: <https://vercel.com/docs/routing/rewrites>.
- Vercel Functions run server-side code per invocation and can be added with function entry points. Source: <https://vercel.com/docs/functions>.
- Vercel's Express guidance requires exporting the Express application or using a recognized Express entry point. It also states that `express.static()` is ignored and static files must be under `public/**`. Source: <https://vercel.com/docs/frameworks/backend/express>.

For this repository, the relevant implementation path is a root-level or `src/` Express/Node server entrypoint that Vercel recognizes as a Function, plus static assets in `public/**`. Vercel's Node runtime documentation says it recognizes a `server.{js,cjs,mjs,ts,cts,mts}` entrypoint and captures a Node server started with `server.listen()`. Vercel's knowledge-base Express guide also describes root `vercel.json` rewrites to an `/api` Express entrypoint. Sources: <https://vercel.com/docs/functions/runtimes/node-js> and <https://vercel.com/kb/guide/using-express-with-vercel>.

The adapter must not use the current `pnpm build` command as Vercel's direct output: that command emits both `dist/public` and `dist/index.js`, and the reported deployment shows that the JavaScript bundle is being served as content. The Vercel configuration must build the Vite client into `public/`, leave the Express entrypoint as a recognized function, route API/OAuth/storage requests to that function, and use an SPA fallback only after these server routes.

The reported deployment at `https://stashvault.vercel.app/` returned the bundled Express source as response content rather than the Vite HTML client. This indicates the current build/server output was deployed as static content rather than configured as a Vercel Function plus client static output.
