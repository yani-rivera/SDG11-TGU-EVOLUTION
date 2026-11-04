Tegucigalpa, 1983 globe — local copy

Browsers block a page opened by double-click (file://) from loading its own data files,
so serve this folder with a tiny local web server:

  1. Open Terminal.
  2. cd into this folder, e.g.:   cd ~/Downloads/tegucigalpa_globe_local
  3. Run:                          python3 -m http.server 8000
  4. In your browser open:         http://localhost:8000
  5. To stop the server: press Ctrl+C in Terminal.

An internet connection is needed for the map library and fonts.
