// Where the scores come from.
//
// Leave SHEET_CSV_URL empty to use data/patrols.json (edit that file by hand).
//
// To use Google Sheets instead: in the sheet, File → Share → Publish to web →
// pick the tab → "Comma-separated values (.csv)" → Publish, then paste the link here.
// The sheet needs one row per family. Blank rows and columns are fine: the site
// finds the column holding the family names, uses the row just above the first
// family as headers, and matches each header to a criterion's id, label or one of
// its "aliases" in data/patrols.json (e.g. "TH" → Town Hall).
//
// MAINTENANCE: true  -> every visitor sees maintenance.html ("under construction").
// MAINTENANCE: false -> the real site is shown. This is the only line to change.
window.PHENIX_CONFIG = {
  MAINTENANCE: false,
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSD6tptKOhuJO5oUHgJJbymDGy5cfYD1EtD81MA3H15zadHV5sVawHeY4-f_P-w_w/pub?gid=232632100&single=true&output=csv"
};
