---
name: Employee Resign Notes & General Notes
description: Profiles table stores optional resign_notes and notes fields, editable in the employee edit dialog and displayed in the employee detail dialog.
type: feature
---
- The `public.profiles` table has two optional text columns: `resign_notes` and `notes`.
- In the employee edit dialog (`Employees > Edit`):
  - When status is set to “Resigned”, a “Keterangan Resign” textarea appears next to the resign date.
  - A separate “Keterangan Lainnya” textarea is always available for general notes.
- Saving updates `resign_notes` and `notes` on the profile. `resign_date` is still cleared when status is not Resigned.
- The employee detail dialog shows the notes in a “Catatan” section under Personal Information when present.
