# ScoreMore Firebase Schema

This build uses:

- Firebase Authentication: Google sign-in
- Firestore: metadata + access control
- File hosting: direct PDF URLs (Google Drive or another file host)

## 1. User access document

Collection:

`users/{uid}`

Example:

```json
{
  "approved": true,
  "class": "Class 10",
  "answerKeysUnlocked": false,
  "displayName": "Aarav Singh"
}
```

Fields:

- `approved`: boolean
- `class`: string, exactly one assigned class per user
- `answerKeysUnlocked`: boolean
- `displayName`: optional string

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
  "questions": 20,
  "marks": 40,
  "duration": 45,
  "addedDate": "2026-05-01",
  "pdfUrl": "https://drive.google.com/uc?export=download&id=FILE_ID",
  "answerKeyUrl": "https://drive.google.com/uc?export=download&id=ANSWER_KEY_ID",
  "answerKeyLocked": true
}
```

Fields:

- `title`: string
- `order`: number
- `questions`: number
- `marks`: number
- `duration`: number
- `addedDate`: string
- `pdfUrl`: string
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
