# Le Trône de Phoenixia

Leaderboard for the troop's 2026–2027 *cadre symbolique*: four families (patrols) compete for the throne of Phoenixia.
A plain static site (HTML, CSS and JS) with no build step and no server.

## Updating the scores

**Option A: edit the JSON (the default).** Change the numbers in `data/patrols.json`, set `updated` to today's date, then commit.

**Option B: Google Sheets.** Make a sheet laid out like this:

| Patrouille | local | progression | esprit |
|------------|-------|-------------|--------|
| Phoenixia  | 12    | 8           | 20     |

Then go to File → Share → Publish to web, choose the tab, choose *CSV*, and paste the link into `SHEET_CSV_URL` in `config.js`.
After that, edits in the sheet appear on the site within a few minutes (Google caches the published file).
If the sheet can't be reached, the site falls back to `data/patrols.json`.

## Settings (in `data/patrols.json`)

- `ranking`: `"total"` or `"average"` of the criteria that are not locked.
- `patrols[].image`: picture for each family's card (e.g. `images/phoenixia.jpg`). Landscape works best (about 16:10); a large letter is shown until a picture is added.
- `criteria[].max` (optional): the score that fills a bar completely, e.g. `"max": 100`. Without it, the family with the best score in that criterion has a full bar and the others are relative to it.
- `criteria`: set `"locked": false` and give a new `label` to reveal criterion 4 or 5. Locked criteria never count toward the ranking.
- Rename `"Famille 4"` once the fourth family's name is decided. If you use the sheet, rename it there too.

## Running locally

`fetch()` doesn't work on `file://`, so serve the folder instead:

```bash
python3 -m http.server 8000
```

## Hosting

Any static host works. With GitHub Pages: Settings → Pages → deploy from branch, then add a `CNAME` file containing your domain and point the domain's DNS at GitHub.

## Design guidelines

UI follows the Vercel Web Interface Guidelines; the skill is vendored in `.claude/skills/web-design-guidelines`.
