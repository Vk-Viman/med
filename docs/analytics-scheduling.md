# Scheduling daily analytics snapshots

This project supports storing snapshot documents under `admin_analytics/{YYYYMMDD}` using `adminComputeAndStoreAnalytics` on the client. For larger datasets, run this on a schedule so dashboards read precomputed data.

## Option A: Firebase Scheduled Functions (Cloud Scheduler + HTTPS)

1. Create an HTTPS endpoint in your Functions backend that invokes the analytics computation service with a fixed range (e.g., 7 days).
2. Use Google Cloud Scheduler to hit this endpoint daily.
3. Secure the endpoint by requiring a secret header or Identity-Aware Proxy.

Pseudocode:

```js
// functions/index.js
exports.dailyAnalytics = functions.https.onRequest(async (req, res) => {
  const { adminComputeAndStoreAnalytics } = require('./services/admin');
  await adminComputeAndStoreAnalytics({ rangeDays: 7 });
  res.json({ ok: true });
});
```

Then set Cloud Scheduler to call it daily.

## Option B: Cloud Functions (pub/sub schedule)

Use pub/sub scheduled Cloud Function:

```js
exports.dailyAnalyticsJob = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  await adminComputeAndStoreAnalytics({ rangeDays: 7 });
});
```

## Option C: GitHub Action / CI

If you don't use Functions, a GitHub Action with a cron can run a Node script that authenticates using a service account and writes the snapshot.

## Dashboard usage

- The Admin Analytics screen already has manual "Compute & Store Snapshot".
- For daily charts, you can load from `admin_analytics/*` first and fall back to live calculations if missing.

## Notes

- Ensure Firestore Security Rules allow your job principal (service account) to write `admin_analytics/*`.
- Keep the range (e.g., 7 days) consistent for trend comparisons.
- Limit per-day work to stay within the Spark/Free plan limits.
