# Birth Time Estimator

**Live Demo:** https://randt.github.io/BirthTimeEstimator/

Estimate birth time windows from Vedic astrology **Lagna (Ascendant)** signs across any 24-hour day, with **Lahiri sidereal** precision and automatic **historical IANA timezone** resolution (e.g., Sri Lanka `UTC+06:00` in 1998 vs `UTC+05:30` in 1995).

Includes both a **zero-dependency HTML/JS web app** (hosted on GitHub Pages) and a **Python CLI** powered by Swiss Ephemeris (`pyswisseph`).

## Web App (GitHub Pages)

Try it live at https://randt.github.io/BirthTimeEstimator/ or open `index.html` directly in a browser.

Features:
- Exact 24-hour Lagna transition windows (1-second binary-search precision)
- Approximate birth time range input (with presets like Morning/Afternoon/Evening or custom From–To) intersected with Lagna windows for tighter birth time ranges (showing exact start–end, midpoint ± uncertainty, and span)
- Clickable **Navamsha (D9)** sub-windows inside any Lagna to narrow the estimated birth time range down to ~13 minutes
- Interactive 24-hour color-coded timeline bar with visual range highlighting
- Lahiri (Chitrapaksha), Krishnamurti (KP), B.V. Raman, and Tropical ayanamsas
- Automatic historical timezone offsets via the browser IANA database (plus manual UTC offset override)
- Quick Sri Lanka, India, and global city presets + OpenStreetMap city search
- CSV export, clipboard summary copy, monochrome UI, and shareable URL parameters

## Python CLI

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python BirthTimeEstimator.py --date 1998-04-06 --lat 6.9271 --lon 79.8612 --tz Asia/Colombo --start-time 06:00 --end-time 12:00 --filter-lagna Taurus
```

Options:
- `--date YYYY-MM-DD` — Local birth date
- `--start-time HH:MM` / `--end-time HH:MM` — Approximate birth time range (default: `00:00` to `24:00`)
- `--lat` / `--lon` — Geographic coordinates (North/East positive)
- `--tz` — IANA timezone (default: `Asia/Colombo`)
- `--utc-offset` — Optional manual UTC offset in hours (overrides `--tz`)
- `--ayanamsa` — `lahiri` (default), `kp`, `raman`, or `tropical`
- `--filter-lagna` — Filter to a specific sign (e.g. `Leo` or `Simha`)
- `--intervals --step 15` — Print full interval breakdown table
