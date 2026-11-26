// Where the scores come from.
//
// Leave SHEET_CSV_URL empty to use data/patrols.json (edit that file by hand).
//
// To use Google Sheets instead: in the sheet, File → Share → Publish to web →
// pick the tab → "Comma-separated values (.csv)" → Publish, then paste the link here.
// The sheet must have one row per patrol. The first column is the patrol name and
// the other column headers match the criterion ids or labels in data/patrols.json,
// for example:  Patrouille | local | progression | esprit
window.PHENIX_CONFIG = {
  SHEET_CSV_URL: ""
};
