# Using Google Drive for PDFs

If Firebase Storage is not a good fit for your region/project choice, this dashboard can use direct file URLs instead.

Recommended practical option:

- upload PDFs to Google Drive
- set file access to "Anyone with the link"
- store the Drive download-style URL in Firestore as `pdfUrl` or `answerKeyUrl`

Preferred download-style link format:

```text
https://drive.google.com/uc?export=download&id=FILE_ID
```

Notes:

- this is simple and works with the current dashboard
- but it is not strong file-level security
- if someone shares the final file URL, another person can open it

So the dashboard access is protected by Firestore/Auth, but the files themselves are only as private as the link.

If you want stronger long-term file protection later, switch from Drive URLs to a private object store with signed URLs.
