# Firestore Index Guidance

This app issues several queries that benefit from or require indexes. Below are the recommended definitions.

## 1. Inbox Queries

Unread count listener:
```
Collection: users/{uid}/inbox
where: read == false
orderBy: (implicit by createdAt when needed)
```
A single-field index on `read` is sufficient (Firestore automatically indexes single fields). For pagination we also order by `createdAt`, so the composite index may be required if you add an explicit orderBy + where combination:
```
Collection: users/{uid}/inbox
Composite: read ASC, createdAt DESC
```

## 2. Mention De-duplication
Queries used:
```
collection(db,'users',uid,'inbox')
where('type','==','mention')
where('data.postId','==', postId)
orderBy('createdAt','desc')
```
Because of two equality filters plus orderBy, Firestore should allow it with a composite index:
```
Collection: users/{uid}/inbox
Composite: type ASC, data.postId ASC, createdAt DESC
```

## 3. displayNameLower Prefix Search
Queries:
```
where('displayNameLower','>=', handle)
where('displayNameLower','<=', handle + '\uf8ff')
```
This uses range + range on the same field; Firestore allows this with the default single-field index on `displayNameLower`. Ensure `displayNameLower` is stored and normalized to lowercase.

## 4. Leaderboard / Participants (Future)
If later adding additional filters together with ordering minutes, you may need:
```
Collection: challenges/{challengeId}/participants
Composite: minutes DESC, joinedAt DESC (example if you add joinedAt ordering)
```

## 5. Users Collection Ordering
Broadcast screen pages users by:
```
orderBy('createdAt','desc')
```
Ensure `createdAt` is present on user documents; single-field index suffices.

## 6. Potential Future Count Queries
If you adopt Firestore count() aggregation on inbox, no extra index beyond those above is required (Firestore uses existing indexes).

## JSON (firestore indexes file sample)
If you maintain an `firestore.indexes.json`, entries would look like:
```json
{
  "indexes": [
    {
      "collectionGroup": "inbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "data.postId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "inbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
Note: Using a collection group `inbox` requires enabling the group queries; adapt if you only query per-user subcollection (you can still define collection group indexes for flexibility).

## Maintenance Notes
- Re-run `firebase deploy --only firestore:indexes` after updating indexes file.
- Monitor the Firebase console for “index required” errors after new query patterns.
- Avoid over-indexing: each composite index consumes storage & write throughput.
