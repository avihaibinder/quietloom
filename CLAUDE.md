# CLAUDE.md

## Rules

- Do NOT read or edit `.env` files (or any environment files like `.env.local`, `.env.production`, etc.).
- Read [team/README.md](team/README.md) at the start of a session for context on the team structure.
- Do NOT commit without explicit permission from the user.

## This is a React Native app

Expo SDK 57 / React Native 0.86 / TypeScript strict. Expo changes fast — read the exact versioned
docs at <https://docs.expo.dev/versions/v57.0.0/> before writing native or config code.

- `android/` and `ios/` are **generated** by `npx expo prebuild` and are git-ignored. Native config
  belongs in [app.json](app.json) or a config plugin, never in the generated projects.
- There is no web build and no browser dev mode. It was a Vite + Capacitor app until the port; if
  you find a doc or comment that still says so, it is stale — fix it.
- `npm run typecheck` is the cheap check. Metro (`npx expo export`) catches import problems that
  the typechecker cannot.
