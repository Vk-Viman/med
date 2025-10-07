# Cloud Functions for med (team aggregation)

This folder contains Firebase Cloud Functions to keep team totals up-to-date and scalable.

What’s included:
- Scheduled aggregator: sums participants minutes into `challenges/{id}/teams/*` `totalMinutes` hourly.
- Realtime participant trigger: re-aggregates a challenge when a participant document is created/updated/deleted.

## Prereqs
- Firebase CLI installed and logged in.
- Project initialized and functions enabled for your Firebase project.

## Install
```
cd functions
npm install
```

## Local emulation (optional)
```
npm run serve
```

## Deploy
```
npm run deploy
```

Notes:
- Uses Node 18 runtime.
- Writes only `totalMinutes` and `updatedAt` under `challenges/{id}/teams/*`.
- Safe to run alongside client-side team totals; server totals will be picked up via the realtime listener.
