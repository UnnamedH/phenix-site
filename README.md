# Le Trône de Phoenixia

Leaderboard for the troop's 2026–2027 *cadre symbolique*: four families (patrols) compete for the throne of Phoenixia.
A plain static site (HTML, CSS and JS) with no build step and no server.

## Updating the scores

**Option A: edit the JSON (the default).** Change the numbers in `data/patrols.json`, set `updated` to today's date, then commit.

**Option B: Google Sheets.** Make a sheet laid out like this:

| Famille   | townhall | trophies | esprit |
|-----------|----------|----------|--------|
| Grizzly | 12       | 8        | 20     |

Then go to File → Share → Publish to web, choose the tab, choose *CSV*, and paste the link into `SHEET_CSV_URL` in `config.js`.
The layout is forgiving: blank rows and columns are fine, and headers can use a criterion's id, label or one of its `aliases` (e.g. `TH`).
After that, edits in the sheet appear on the site within a few minutes (Google caches the published file).
If the sheet can't be reached, the site falls back to `data/patrols.json`.

## Settings (in `data/patrols.json`)

- `throne`: the family sitting on the throne (e.g. `"Condor"`), or `null` to keep it empty. It is set by hand on purpose: the throne goes to the family that completes all its stats.
- `ranking`: `"total"` or `"average"` of the criteria that are not locked.
- `patrols[].color`: each family's colour (used for its knight, banner and bars) (hex, e.g. `"#d4553f"`).
- `patrols[].image`: picture for each family's card (e.g. `images/phoenixia.jpg`). Square works best; it replaces the pixel knight on the family's card once the file exists.
- `criteria[].max` (optional): the score that fills a bar completely, e.g. `"max": 100`. Without it, the family with the best score in that criterion has a full bar and the others are relative to it.
- `criteria`: set `"locked": false` and give a new `label` to reveal criterion 4 or 5. Locked criteria never count toward the ranking.
- Family names in the sheet must match the names in `data/patrols.json`, because that is how each family keeps its picture.

## Running locally

`fetch()` doesn't work on `file://`, so serve the folder instead:

```bash
python3 -m http.server 8000
```

## Hosting

Any static host works. With GitHub Pages: Settings → Pages → deploy from branch, then add a `CNAME` file containing your domain and point the domain's DNS at GitHub.

## Design guidelines

UI follows the Vercel Web Interface Guidelines; the skill is vendored in `.claude/skills/web-design-guidelines`.
