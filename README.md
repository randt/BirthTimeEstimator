# Birth Time Estimator

Estimate birth time windows from Vedic astrology **Lagna (Ascendant)** signs across any 24-hour day, with **Lahiri sidereal** precision and automatic **historical IANA timezone** resolution (e.g., Sri Lanka `UTC+06:00` in 1998 vs `UTC+05:30` in 1995).

Includes both a **zero-dependency HTML/JS web app** (ready for GitHub Pages) and a **Python CLI** powered by Swiss Ephemeris (`pyswisseph`).

## Web App (GitHub Pages)

Open `index.html` directly in a browser or deploy via GitHub Pages (branch `main`, root `/`).

Features:
- Exact 24-hour Lagna transition windows (1-second binary-search precision)
- Interactive 24-hour color-coded timeline bar
- Filter by known Lagna sign to view exact birth time windows and **Navamsha (D9)** sub-windows (~13 minutes each)
- Lahiri (Chitrapaksha), Krishnamurti (KP), B.V. Raman, and Tropical ayanamsas
- Automatic historical timezone offsets via the browser IANA database (plus manual UTC offset override)
- Quick Sri Lanka, India, and global city presets + OpenStreetMap city search
- CSV export, clipboard summary copy, dark/light theme, and shareable URL parameters

## Python CLI

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python BirthTimeEstimator.py --date 1998-04-06 --lat 6.9271 --lon 79.8612 --tz Asia/Colombo
```

Options:
- `--date YYYY-MM-DD` — Local birth date
- `--lat` / `--lon` — Geographic coordinates (North/East positive)
- `--tz` — IANA timezone (default: `Asia/Colombo`)
- `--utc-offset` — Optional manual UTC offset in hours (overrides `--tz`)
- `--ayanamsa` — `lahiri` (default), `kp`, `raman`, or `tropical`
- `--filter-lagna` — Filter to a specific sign (e.g. `Leo` or `Simha`)
- `--intervals --step 15` — Print full interval breakdown table
