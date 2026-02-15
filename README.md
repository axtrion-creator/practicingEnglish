# Finnish to English Practice App

Browser-based app for practicing Finnish to English vocabulary.

## Features

- Import words from `.xlsx`, `.xls`, or `.csv`
- Input format:
  - Column `A`: Finnish word
  - Column `B`: English translation
  - Column `C` (optional): chapter (defaults to `General`)
- 3 game modes:
  - `Combine boxes` (both Finnish and English columns are alphabetical)
  - `Write translations`
  - `Flashcards`
- Optional timed mode (`1:00`)
- Chapter filtering works for:
  - imported local files
  - Supabase database words
- Supabase persistence:
  - save words with chapter metadata
  - save play sessions and per-word performance
  - cumulative user stats (`times_played`, `correct_guesses`, `total_attempts`)

## Quick Start

1. Open `index.html` in your browser.
2. Choose game mode and optional timer.
3. Load a file or sample words.
4. Optionally filter by chapter and click `Load Chapter`.
5. Start practicing.

## File Example

| Finnish | English | Chapter |
| --- | --- | --- |
| kissa | cat | Animals |
| koira | dog | Animals |
| koti | home | Daily life |

`template.csv` includes this structure.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL editor.
3. In the app, enter:
   - `Supabase URL`
   - `Anon key`
   - `Player name`
4. Click `Connect DB`.
5. Use:
   - `Save Current Words to DB` to upload imported words
   - `Chapter` + `Load Chapter` to load database chapters

## Project Files

- `index.html`: UI markup
- `styles.css`: styles
- `app.js`: game logic + Supabase integration
- `supabase/schema.sql`: database schema and policies
- `template.csv`: import template

## Notes

- App uses CDN scripts for:
  - SheetJS (`xlsx`)
  - Supabase JS client
- If scripts fail to load, refresh and verify internet connection.
