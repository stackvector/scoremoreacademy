# ScoreMore Firebase Schema

This build uses:

- Firebase Authentication: Google sign-in
- Firestore: metadata + access control
- File hosting: direct PDF URLs (Google Drive or another file host)
- Separate admin access via `adminUsers/{uid}`

## 1. User access document

Collection:

`users/{uid}`

Example:

```json
{
  "approved": false,
  "class": "Class 10",
  "answerKeysUnlocked": false,
  "displayName": "Aarav Singh",
  "email": "aarav@example.com",
  "requestedSubjects": "Maths + Science"
}
```

Fields:

- `approved`: boolean
- `class`: string, exactly one assigned class per user
- `answerKeysUnlocked`: boolean
- `displayName`: optional string
- `email`: optional string
- `requestedSubjects`: optional string for admin review

## 1A. Admin access document

Collection:

`adminUsers/{uid}`

Example:

```json
{
  "active": true,
  "role": "super-admin"
}
```

Fields:

- `active`: boolean
- `role`: string

## 2. Test series hierarchy

Top-level collection:

`testSeries/{class}/subjects/{subject}/chapters/{chapter}`

### Subject document

Path example:

`testSeries/Class 10/subjects/Mathematics`

Example:

```json
{
  "label": "Mathematics",
  "order": 1
}
```

### Chapter document

Path example:

`testSeries/Class 10/subjects/Mathematics/chapters/linear-equations-test-1`

Example:

```json
{
  "title": "Linear Equations Test 1",
  "order": 1,
  "format": "pdf",
  "deliveryStatus": "live",
  "questions": 20,
  "marks": 40,
  "duration": 45,
  "addedDate": "2026-05-01",
  "shortLabel": "QFT 1",
  "summary": "Offline-first chapter paper ready to download and solve.",
  "pdfUrl": "https://drive.google.com/uc?export=download&id=FILE_ID",
  "testUrl": "",
  "answerKeyUrl": "https://drive.google.com/uc?export=download&id=ANSWER_KEY_ID",
  "answerKeyLocked": true
}
```

Fields:

- `title`: string
- `order`: number
- `format`: `pdf` | `latex` | `timed`
- `deliveryStatus`: `live` | `coming-soon`
- `questions`: number
- `marks`: number
- `duration`: number
- `addedDate`: string
- `shortLabel`: optional short graph label like `QFT 1`
- `summary`: optional card summary
- `pdfUrl`: string
- `testUrl`: optional string for future interactive / timed tests
- `answerKeyUrl`: string, optional
- `answerKeyLocked`: boolean

## 3. Exact class names

Use exactly one of these strings per user:

- `Class 5`
- `Class 6`
- `Class 7`
- `Class 8`
- `Class 9`
- `Class 10`
- `Class 11`
- `Class 12`

## 4. Suggested exact subject names

Use consistent subject IDs / names such as:

- `Mathematics`
- `Science`
- `Physics`
- `Chemistry`
- `Biology`

Keep subject names identical between Firestore and the dashboard UI.

## 5. Answer key behavior

The dashboard shows the answer key only when:

- `answerKeyUrl` exists
- and either:
  - `answerKeyLocked` is `false`
  - or the user document has `answerKeysUnlocked: true`

Recommended approach:

- keep `answerKeyLocked: true` on chapter docs
- manually unlock per user with `answerKeysUnlocked: true`

## 6. Admin workflow

1. Student signs in on the dashboard.
2. Their `users/{uid}` document exists with `approved: false`.
3. Admin signs into `admin.html`.
4. Admin must have `adminUsers/{uid}` with `active: true`.
5. Admin approves the student by updating `approved: true` and confirming the `class`.
6. Admin publishes subject chapters into `testSeries/{class}/subjects/{subject}/chapters/{chapter}`.
