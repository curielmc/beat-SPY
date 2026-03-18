# Jasper API

`Jasper` is a server-side import API for generating tutorials from teaching material and attaching a downloadable slide deck PDF to each tutorial.

## Endpoints

### Create Jasper token

`POST /api/jasper/tokens`

Headers:

```text
Authorization: Bearer <supabase-user-access-token>
Content-Type: application/json
```

Body:

```json
{
  "label": "Claude Code",
  "scopes": ["tutorials:create", "tutorials:assign", "tutorials:publish"]
}
```

This endpoint requires an authenticated admin user. It returns the plain Jasper token once.

### Import tutorial

`POST /api/jasper/import-tutorial`

Headers:

```text
Authorization: Bearer <jasper_token>
Content-Type: application/json
```

Body:

```json
{
  "title": "Dividend Basics",
  "category": "investments",
  "status": "draft",
  "source_type": "google-slides",
  "source_url": "https://docs.google.com/presentation/d/FILE_ID/edit",
  "source_export_url": "https://docs.google.com/presentation/d/FILE_ID/export/pdf",
  "source_name": "Dividend Basics Deck",
  "source_text": "Optional extracted or pasted text",
  "class_ids": ["CLASS_UUID"]
}
```

## MVP behavior

- `source_text` is the most reliable input and should be preferred when your external agent can extract text itself.
- If `source_text` is omitted, Jasper will try to fetch text from `source_export_url` or `source_url`.
- PDF URLs are supported when they are publicly reachable and text-based.
- Google Slides edit links are automatically converted to their PDF export URL.
- Google Drive file links are automatically converted to a direct download URL when the file ID can be detected.
- PowerPoint and Google Slides links are supported as metadata inputs and for deck linking, but this MVP expects either:
  - `source_text`, or
  - a usable `source_export_url` that points to an exported PDF.

## Suggested flow for external agents

1. Read the source file or slides.
2. Extract the text externally when possible.
3. Call `POST /api/jasper/import-tutorial`.
4. Optionally pass `class_ids` and `status: "active"` if the token has those scopes.

## Notes

- Imported tutorials are stored in `training_tutorials` and `training_steps`.
- Deck PDF links are stored in `training_tutorials.deck_pdf_url`.
- The course page will show a `Download Slides PDF` button when `deck_pdf_url` exists.
