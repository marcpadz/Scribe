# Google Client ID never wired → Drive login silently disabled

**Status:** Open (confirmed)
**Created:** 2026-08-18
**Tags:** #auth #config #bug

## Symptoms
- Clicking "Continue with Google" does nothing / no Google picker appears.
- `driveService.ts` logs "Skipping GIS Init: REACT_APP_GOOGLE_CLIENT_ID is missing".
- Drive import/save features are unreachable.

## Root Cause
`driveService.ts` reads `process.env.REACT_APP_GOOGLE_CLIENT_ID`, but `vite.config.ts`
only `define`s `process.env.API_KEY` and `process.env.GEMINI_API_KEY`. Vite does not
expose arbitrary `process.env.*` at runtime unless listed in `define`, so the value is
`undefined` and GIS init is skipped.

## Resolution
- Add `'process.env.REACT_APP_GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID)`
  to `vite.config.ts` `define`, sourced from `.env.local`.
- Or migrate to `import.meta.env.VITE_GOOGLE_CLIENT_ID` (Vite-native) and update reads.

## Prevention
- [ ] Any `process.env.X` used in client code must appear in `vite.config.ts` `define`.
- [ ] Add a startup assertion that Client ID is present when Drive UI is shown.
