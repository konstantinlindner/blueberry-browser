# Blueberry Companion

Expo app for starting, watching, steering and approving Blueberry browser agent tasks from your phone.
Runs in **Expo Go**. See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for how it fits together.

## Run

From the repo root, start the desktop app (needs an LLM key in `.env`):

```bash
pnpm dev
```

It prints a pairing QR code in the terminal. Then start the app:

```bash
cd apps/companion
npx expo start
```

Open it in Expo Go and scan the desktop's pairing code from the app. Phone and computer must be on the same Wi-Fi.

## Without the desktop

`scripts/mock-desktop.ts` plays a scripted task over the same protocol, so the app can be developed without
Electron or an LLM:

```bash
npx tsx scripts/mock-desktop.ts [frame.jpg ...]
```

Pair with the link it prints (`token=mock`). In a browser (`npx expo start --web`) you can paste the link instead of
scanning.
