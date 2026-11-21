#!/usr/bin/env python3
"""
BirthTimeEstimator — Vedic Lagna (Ascendant) & Birth Time Window Calculator.

Uses Swiss Ephemeris (pyswisseph) with proper sidereal calculation
(swe.houses_ex + swe.FLG_SIDEREAL) and IANA historical timezones via pytz.
"""

import argparse
import datetime
import pytz
import swisseph as swe

ZODIAC_SIGNS = [
    ("Aries", "Mesha"),
    ("Taurus", "Vrishabha"),
    ("Gemini", "Mithuna"),
    ("Cancer", "Karka"),
    ("Leo", "Simha"),
    ("Virgo", "Kanya"),
    ("Libra", "Tula"),
    ("Scorpio", "Vrishchika"),
    ("Sagittarius", "Dhanu"),
    ("Capricorn", "Makara"),
    ("Aquarius", "Kumbha"),
    ("Pisces", "Meena"),
]

AYANAMSA_MODES = {
    "lahiri": swe.SIDM_LAHIRI,
    "raman": swe.SIDM_RAMAN,
    "kp": swe.SIDM_KRISHNAMURTI,
    "tropical": None,
}


def resolve_utc_datetime(local_dt: datetime.datetime, tz_name: str = None, utc_offset_hours: float = None) -> datetime.datetime:
    """Convert a naive local datetime to a timezone-aware UTC datetime."""
    if utc_offset_hours is not None:
        tz = datetime.timezone(datetime.timedelta(hours=utc_offset_hours))
        return local_dt.replace(tzinfo=tz).astimezone(datetime.timezone.utc)

    tz = pytz.timezone(tz_name or "Asia/Colombo")
    localized = tz.localize(local_dt)
    return localized.astimezone(pytz.UTC)


def compute_ascendant(utc_dt: datetime.datetime, latitude: float, longitude: float, ayanamsa: str = "lahiri") -> float:
    """Compute the Ascendant (Lagna) longitude in degrees [0, 360)."""
    hour_decimal = (
        utc_dt.hour
        + utc_dt.minute / 60.0
        + (utc_dt.second + utc_dt.microsecond / 1e6) / 3600.0
    )
    jd = swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, hour_decimal)

    mode = AYANAMSA_MODES[ayanamsa.lower()]
    if mode is None:
        _, ascmc = swe.houses_ex(jd, latitude, longitude, b"A", 0)
    else:
        swe.set_sid_mode(mode)
        _, ascmc = swe.houses_ex(jd, latitude, longitude, b"A", swe.FLG_SIDEREAL)

    return ascmc[0] % 360.0


def sign_index(longitude_deg: float) -> int:
    return int(longitude_deg // 30) % 12


def format_dms(deg_in_sign: float) -> str:
    d = int(deg_in_sign)
    m = int((deg_in_sign - d) * 60)
    return f"{d:02d}°{m:02d}'"


def calculate_lagnas(
    date: datetime.date,
    latitude: float,
    longitude: float,
    tz_name: str = "Asia/Colombo",
    utc_offset_hours: float = None,
    step_minutes: int = 15,
    ayanamsa: str = "lahiri",
):
    """Calculate Lagna signs at fixed intervals across a local calendar day."""
    start_local = datetime.datetime(date.year, date.month, date.day, 0, 0, 0)
    intervals = []

    for minute in range(0, 1440, step_minutes):
        local_dt = start_local + datetime.timedelta(minutes=minute)
        utc_dt = resolve_utc_datetime(local_dt, tz_name=tz_name, utc_offset_hours=utc_offset_hours)
        asc = compute_ascendant(utc_dt, latitude, longitude, ayanamsa=ayanamsa)
        idx = sign_index(asc)
        western, vedic = ZODIAC_SIGNS[idx]
        intervals.append(
            {
                "time": local_dt.strftime("%H:%M"),
                "sign": western,
                "vedic_sign": vedic,
                "longitude": asc,
                "degree_in_sign": asc % 30.0,
            }
        )

    return intervals


def parse_hhmm_to_seconds(value: str, is_end: bool = False) -> int:
    """Parse HH:MM or HH:MM:SS into seconds since midnight [0, 86400]."""
    text = value.strip()
    if text in ("24:00", "24:00:00"):
        return 86400
    parts = [int(p) for p in text.split(":")]
    if len(parts) == 2:
        h, m = parts
        s = 0
    elif len(parts) == 3:
        h, m, s = parts
    else:
        raise ValueError(f"Invalid time format: {value!r} (expected HH:MM or HH:MM:SS)")
    total = h * 3600 + m * 60 + s
    if is_end and text == "23:59":
        return 86400
    return max(0, min(86400, total))


def format_seconds(sec: int) -> str:
    if sec >= 86400:
        return "24:00:00"
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def clip_windows_to_range(windows, start_sec: int, end_sec: int):
    """Intersect Lagna windows with a user-supplied approximate birth time range."""
    clipped = []
    for w in windows:
        lo = max(w["start_sec"], start_sec)
        hi = min(w["end_sec"], end_sec)
        if hi > lo:
            mid = (lo + hi) // 2
            half_min = round((hi - lo) / 120.0, 1)
            clipped.append(
                {
                    **w,
                    "start_sec": lo,
                    "end_sec": hi,
                    "start": format_seconds(lo),
                    "end": format_seconds(hi),
                    "midpoint": format_seconds(mid),
                    "plus_minus_minutes": half_min,
                    "duration_minutes": round((hi - lo) / 60.0, 1),
                }
            )
    return clipped


def calculate_lagna_windows(
    date: datetime.date,
    latitude: float,
    longitude: float,
    tz_name: str = "Asia/Colombo",
    utc_offset_hours: float = None,
    ayanamsa: str = "lahiri",
):
    """Find exact start/end times (1-second precision) for each Lagna during a local day."""
    start_local = datetime.datetime(date.year, date.month, date.day, 0, 0, 0)

    def sign_at_second(sec: int) -> int:
        local_dt = start_local + datetime.timedelta(seconds=sec)
        utc_dt = resolve_utc_datetime(local_dt, tz_name=tz_name, utc_offset_hours=utc_offset_hours)
        return sign_index(compute_ascendant(utc_dt, latitude, longitude, ayanamsa=ayanamsa))

    total_seconds = 86400
    step = 300  # 5-minute coarse scan
    windows = []

    cur_start = 0
    cur_sign = sign_at_second(0)

    for probe in range(step, total_seconds + 1, step):
        t = min(probe, total_seconds - 1)
        s = sign_at_second(t)
        if s != cur_sign:
            # Binary search exact transition second between (probe - step) and t
            lo = probe - step
            hi = t
            while hi - lo > 1:
                mid = (lo + hi) // 2
                if sign_at_second(mid) == cur_sign:
                    lo = mid
                else:
                    hi = mid
            windows.append((cur_start, hi, cur_sign))
            cur_start = hi
            cur_sign = sign_at_second(hi)

    windows.append((cur_start, total_seconds, cur_sign))

    result = []
    for s_sec, e_sec, idx in windows:
        western, vedic = ZODIAC_SIGNS[idx]
        mid_sec = (s_sec + e_sec) // 2
        result.append(
            {
                "start_sec": s_sec,
                "end_sec": e_sec,
                "start": format_seconds(s_sec),
                "end": format_seconds(e_sec),
                "midpoint": format_seconds(mid_sec),
                "plus_minus_minutes": round((e_sec - s_sec) / 120.0, 1),
                "sign": western,
                "vedic_sign": vedic,
                "duration_minutes": round((e_sec - s_sec) / 60.0, 1),
            }
        )
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Estimate Vedic Lagna (Ascendant) birth time ranges for a given date and location."
    )
    parser.add_argument("--date", default="1998-04-06", help="Local birth date in YYYY-MM-DD (default: 1998-04-06)")
    parser.add_argument("--lat", type=float, default=6.9271, help="Latitude in degrees, North positive (default: 6.9271, Colombo)")
    parser.add_argument("--lon", type=float, default=79.8612, help="Longitude in degrees, East positive (default: 79.8612, Colombo)")
    parser.add_argument("--tz", default="Asia/Colombo", help="IANA timezone name (default: Asia/Colombo)")
    parser.add_argument("--utc-offset", type=float, default=None, help="Manual UTC offset in hours (overrides --tz)")
    parser.add_argument("--ayanamsa", choices=list(AYANAMSA_MODES.keys()), default="lahiri", help="Ayanamsa system (default: lahiri)")
    parser.add_argument("--start-time", default="00:00", help="Approximate birth time range start HH:MM (default: 00:00)")
    parser.add_argument("--end-time", default="24:00", help="Approximate birth time range end HH:MM (default: 24:00)")
    parser.add_argument("--step", type=int, default=15, help="Interval size in minutes for the table (default: 15)")
    parser.add_argument("--filter-lagna", default=None, help="Filter output to a specific Lagna sign (e.g. Leo or Simha)")
    parser.add_argument("--intervals", action="store_true", help="Also print the full interval breakdown table")
    args = parser.parse_args()

    target_date = datetime.date.fromisoformat(args.date)
    start_sec = parse_hhmm_to_seconds(args.start_time, is_end=False)
    end_sec = parse_hhmm_to_seconds(args.end_time, is_end=True)
    if end_sec <= start_sec:
        raise SystemExit("Error: --end-time must be after --start-time")

    sample_local = datetime.datetime(target_date.year, target_date.month, target_date.day, 12, 0)
    if args.utc_offset is not None:
        tz_label = f"UTC{args.utc_offset:+g}"
    else:
        tz_obj = pytz.timezone(args.tz)
        offset = tz_obj.localize(sample_local).utcoffset()
        total_mins = int(offset.total_seconds() // 60)
        sign = "+" if total_mins >= 0 else "-"
        hh, mm = divmod(abs(total_mins), 60)
        tz_label = f"{args.tz} (UTC{sign}{hh:02d}:{mm:02d})"

    print(
        f"Date: {target_date} | Range: {format_seconds(start_sec)} - {format_seconds(end_sec)} | "
        f"Lat: {args.lat}, Lon: {args.lon} | TZ: {tz_label} | Ayanamsa: {args.ayanamsa.upper()}"
    )
    print("\nEstimated Birth Time Ranges (by Lagna):")
    all_windows = calculate_lagna_windows(
        target_date, args.lat, args.lon, tz_name=args.tz, utc_offset_hours=args.utc_offset, ayanamsa=args.ayanamsa
    )
    windows = clip_windows_to_range(all_windows, start_sec, end_sec)
    matched = 0
    for w in windows:
        if args.filter_lagna:
            q = args.filter_lagna.strip().lower()
            if q not in (w["sign"].lower(), w["vedic_sign"].lower()):
                continue
        matched += 1
        print(
            f"  {w['start']} - {w['end']}  {w['sign']:<12} ({w['vedic_sign']:<10})  "
            f"[midpoint {w['midpoint']} +/- {w['plus_minus_minutes']:.1f} min, span {w['duration_minutes']:.1f} min]"
        )
    if matched == 0:
        print("  No matching Lagna found in the specified time range.")

    if args.intervals:
        print(f"\n{args.step}-Minute Intervals:")
        rows = calculate_lagnas(
            target_date,
            args.lat,
            args.lon,
            tz_name=args.tz,
            utc_offset_hours=args.utc_offset,
            step_minutes=args.step,
            ayanamsa=args.ayanamsa,
        )
        for r in rows:
            hh, mm = map(int, r["time"].split(":"))
            sec = hh * 3600 + mm * 60
            if sec < start_sec or sec > end_sec:
                continue
            if args.filter_lagna:
                q = args.filter_lagna.strip().lower()
                if q not in (r["sign"].lower(), r["vedic_sign"].lower()):
                    continue
            print(f"  {r['time']}  {r['sign']:<12} ({r['vedic_sign']:<10})  {format_dms(r['degree_in_sign'])}")


if __name__ == "__main__":
    main()
