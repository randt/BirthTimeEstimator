(function () {
  "use strict";

  const Astro = window.BirthTimeAstro;

  // DOM Elements
  const birthDateEl = document.getElementById("birthDate");
  const cityPresetEl = document.getElementById("cityPreset");
  const citySearchEl = document.getElementById("citySearch");
  const searchCityBtn = document.getElementById("searchCityBtn");
  const searchResultsEl = document.getElementById("searchResults");
  const latitudeEl = document.getElementById("latitude");
  const longitudeEl = document.getElementById("longitude");
  const timezoneEl = document.getElementById("timezone");
  const useManualOffsetEl = document.getElementById("useManualOffset");
  const manualOffsetEl = document.getElementById("manualOffset");
  const ayanamsaEl = document.getElementById("ayanamsa");
  const stepMinutesEl = document.getElementById("stepMinutes");
  const rangeStartEl = document.getElementById("rangeStart");
  const rangeEndEl = document.getElementById("rangeEnd");
  const rangePresetsEl = document.getElementById("rangePresets");

  const tzDetectedBadge = document.getElementById("tzDetectedBadge");
  const signPillsEl = document.getElementById("signPills");
  const clearFilterBtn = document.getElementById("clearFilterBtn");
  const selectedLagnaSummaryEl = document.getElementById("selectedLagnaSummary");
  const metaSummaryEl = document.getElementById("metaSummary");
  const timelineBarEl = document.getElementById("timelineBar");
  const windowsGridEl = document.getElementById("windowsGrid");
  const intervalCountTextEl = document.getElementById("intervalCountText");
  const intervalTableBodyEl = document.getElementById("intervalTableBody");
  const copySummaryBtn = document.getElementById("copySummaryBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const themeToggleBtn = document.getElementById("themeToggle");
  const themeIconEl = document.getElementById("themeIcon");
  const themeLabelEl = document.getElementById("themeLabel");
  const toastEl = document.getElementById("toast");

  let selectedSignIndex = null; // null = all signs
  let selectedNavamshaIndex = null; // optional D9 filter inside selected Lagna
  let rangeEndIsMidnight = true; // true represents 24:00:00 (end of day)
  let lastState = null;
  let lastWindows = [];
  let lastClippedWindows = [];
  let lastIntervals = [];
  let toastTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2600);
  }

  // Populate IANA timezone list
  function populateTimezones() {
    const pinned = [
      "Asia/Colombo",
      "Asia/Kolkata",
      "Asia/Kathmandu",
      "Asia/Dhaka",
      "Asia/Karachi",
      "Asia/Singapore",
      "Europe/London",
      "Europe/Dublin",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Australia/Sydney",
      "UTC",
    ];
    let allZones = pinned;
    if (typeof Intl.supportedValuesOf === "function") {
      try {
        allZones = Intl.supportedValuesOf("timeZone");
      } catch (_) {
        allZones = pinned;
      }
    }

    const pinnedGroup = document.createElement("optgroup");
    pinnedGroup.label = "Common Timezones";
    pinned.forEach((tz) => {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz;
      pinnedGroup.appendChild(opt);
    });
    timezoneEl.appendChild(pinnedGroup);

    const allGroup = document.createElement("optgroup");
    allGroup.label = "All IANA Timezones";
    allZones.forEach((tz) => {
      if (pinned.includes(tz)) return;
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz;
      allGroup.appendChild(opt);
    });
    timezoneEl.appendChild(allGroup);

    timezoneEl.value = "Asia/Colombo";
  }

  // Render the 12 sign filter pills
  function renderSignPills() {
    signPillsEl.innerHTML = "";
    Astro.ZODIAC_SIGNS.forEach((sign) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sign-pill" + (selectedSignIndex === sign.index ? " active" : "");
      btn.dataset.signIndex = String(sign.index);
      btn.innerHTML = `
        <span class="sign-dot" style="background:${sign.color}"></span>
        <span>${sign.name}</span>
        <span class="sign-pill-vedic">${sign.vedic}</span>
      `;
      btn.addEventListener("click", () => {
        if (selectedSignIndex === sign.index) {
          selectedSignIndex = null;
          selectedNavamshaIndex = null;
        } else {
          selectedSignIndex = sign.index;
          selectedNavamshaIndex = null;
        }
        updateAll();
      });
      signPillsEl.appendChild(btn);
    });
  }

  function parseTimeToSeconds(val, treatEndAsFullDay) {
    if (!val) return treatEndAsFullDay ? 86400 : 0;
    if (val === "24:00" || val === "24:00:00") return 86400;
    const [h, m] = val.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return treatEndAsFullDay ? 86400 : 0;
    if (treatEndAsFullDay && rangeEndIsMidnight && h === 23 && m === 59) return 86400;
    return Math.max(0, Math.min(86400, h * 3600 + m * 60));
  }

  function clipWindow(w, startSec, endSec) {
    const lo = Math.max(w.startSec, startSec);
    const hi = Math.min(w.endSec, endSec);
    if (hi <= lo) return null;
    const durSec = hi - lo;
    const midSec = Math.floor((lo + hi) / 2);
    return {
      ...w,
      startSec: lo,
      endSec: hi,
      startTime: Astro.formatSecondsToHMS(lo),
      endTime: Astro.formatSecondsToHMS(hi),
      startHM: Astro.formatSecondsToHM(lo),
      endHM: Astro.formatSecondsToHM(hi),
      midpointTime: Astro.formatSecondsToHMS(midSec),
      plusMinusMin: Math.round((durSec / 120) * 10) / 10,
      durationMinutes: Math.round((durSec / 60) * 10) / 10,
    };
  }

  function readStateFromInputs() {
    const [year, month, day] = (birthDateEl.value || "1998-04-06").split("-").map(Number);
    const latitude = parseFloat(latitudeEl.value);
    const longitude = parseFloat(longitudeEl.value);
    const timeZone = timezoneEl.value || "Asia/Colombo";
    const useManual = useManualOffsetEl.checked;
    const manualOffsetHours = parseFloat(manualOffsetEl.value);
    const manualOffsetMinutes = useManual && Number.isFinite(manualOffsetHours) ? manualOffsetHours * 60 : null;
    const ayanamsa = ayanamsaEl.value || "lahiri";
    const stepMinutes = parseInt(stepMinutesEl.value, 10) || 15;

    let rangeStartSec = parseTimeToSeconds(rangeStartEl.value, false);
    let rangeEndSec = parseTimeToSeconds(rangeEndEl.value, true);
    if (rangeEndSec <= rangeStartSec) {
      rangeStartSec = 0;
      rangeEndSec = 86400;
    }

    return {
      dateStr: birthDateEl.value || "1998-04-06",
      year,
      month,
      day,
      latitude: Number.isFinite(latitude) ? Math.max(-66, Math.min(66, latitude)) : 6.9271,
      longitude: Number.isFinite(longitude) ? Math.max(-180, Math.min(180, longitude)) : 79.8612,
      timeZone,
      manualOffsetMinutes,
      ayanamsa,
      stepMinutes,
      rangeStartSec,
      rangeEndSec,
      isCustomRange: rangeStartSec > 0 || rangeEndSec < 86400,
    };
  }

  function syncRangePresetButtons(startSec, endSec) {
    const startStr = Astro.formatSecondsToHM(startSec);
    const endStr = endSec >= 86400 ? "24:00" : Astro.formatSecondsToHM(endSec);
    rangePresetsEl.querySelectorAll("button").forEach((btn) => {
      const match = btn.dataset.start === startStr && btn.dataset.end === endStr;
      btn.classList.toggle("active", match);
    });
  }

  function syncUrlParams(state) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("date", state.dateStr);
      url.searchParams.set("lat", state.latitude.toFixed(4));
      url.searchParams.set("lon", state.longitude.toFixed(4));
      url.searchParams.set("tz", state.timeZone);
      url.searchParams.set("ayanamsa", state.ayanamsa);
      url.searchParams.set("step", String(state.stepMinutes));
      if (state.isCustomRange) {
        url.searchParams.set("start", Astro.formatSecondsToHM(state.rangeStartSec));
        url.searchParams.set("end", state.rangeEndSec >= 86400 ? "24:00" : Astro.formatSecondsToHM(state.rangeEndSec));
      } else {
        url.searchParams.delete("start");
        url.searchParams.delete("end");
      }
      if (state.manualOffsetMinutes !== null) {
        url.searchParams.set("offset", String(state.manualOffsetMinutes / 60));
      } else {
        url.searchParams.delete("offset");
      }
      if (selectedSignIndex !== null) {
        url.searchParams.set("lagna", Astro.ZODIAC_SIGNS[selectedSignIndex].name.toLowerCase());
      } else {
        url.searchParams.delete("lagna");
      }
      if (selectedNavamshaIndex !== null) {
        url.searchParams.set("d9", Astro.ZODIAC_SIGNS[selectedNavamshaIndex].name.toLowerCase());
      } else {
        url.searchParams.delete("d9");
      }
      window.history.replaceState({}, "", url.toString());
    } catch (_) {
      // Ignore if running from restricted file:// origin
    }
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("date")) birthDateEl.value = params.get("date");
    if (params.has("lat")) {
      latitudeEl.value = params.get("lat");
      cityPresetEl.value = "custom";
    }
    if (params.has("lon")) {
      longitudeEl.value = params.get("lon");
      cityPresetEl.value = "custom";
    }
    if (params.has("tz")) {
      const tz = params.get("tz");
      if ([...timezoneEl.options].some((o) => o.value === tz)) {
        timezoneEl.value = tz;
      }
    }
    if (params.has("offset")) {
      useManualOffsetEl.checked = true;
      manualOffsetEl.disabled = false;
      manualOffsetEl.value = params.get("offset");
    }
    if (params.has("ayanamsa") && Astro.AYANAMSA_COEFFS[params.get("ayanamsa")]) {
      ayanamsaEl.value = params.get("ayanamsa");
    }
    if (params.has("step")) {
      stepMinutesEl.value = params.get("step");
    }
    if (params.has("start")) {
      rangeStartEl.value = params.get("start");
    }
    if (params.has("end")) {
      const endVal = params.get("end");
      if (endVal === "24:00") {
        rangeEndEl.value = "23:59";
        rangeEndIsMidnight = true;
      } else {
        rangeEndEl.value = endVal;
        rangeEndIsMidnight = false;
      }
    }
    if (params.has("lagna")) {
      const q = params.get("lagna").toLowerCase();
      const match = Astro.ZODIAC_SIGNS.find(
        (s) => s.name.toLowerCase() === q || s.vedic.toLowerCase() === q
      );
      if (match) selectedSignIndex = match.index;
    }
    if (params.has("d9")) {
      const q = params.get("d9").toLowerCase();
      const match = Astro.ZODIAC_SIGNS.find(
        (s) => s.name.toLowerCase() === q || s.vedic.toLowerCase() === q
      );
      if (match) selectedNavamshaIndex = match.index;
    }
  }

  function updateAll() {
    const state = readStateFromInputs();
    if (!state.year || !state.month || !state.day) return;

    lastState = state;
    syncRangePresetButtons(state.rangeStartSec, state.rangeEndSec);

    // Detect effective UTC offset at local noon on the chosen date
    const noonUTC = Astro.localToUTCDate(
      state.year,
      state.month,
      state.day,
      43200,
      state.timeZone,
      state.manualOffsetMinutes
    );
    const effectiveOffsetMin =
      state.manualOffsetMinutes !== null
        ? state.manualOffsetMinutes
        : Astro.getTimeZoneOffsetMinutes(noonUTC, state.timeZone);
    const offsetStr = Astro.formatOffsetMinutes(effectiveOffsetMin);

    tzDetectedBadge.textContent =
      state.manualOffsetMinutes !== null
        ? `Manual Offset: ${offsetStr}`
        : `${state.timeZone} on ${state.dateStr} → ${offsetStr}`;

    const ayanamsaDeg = Astro.getMeanAyanamsa(Astro.dateToJulianDayUT(noonUTC), state.ayanamsa);
    const ayanamsaCfg = Astro.AYANAMSA_COEFFS[state.ayanamsa];
    const rangeLabel = `${Astro.formatSecondsToHM(state.rangeStartSec)}–${state.rangeEndSec >= 86400 ? "24:00" : Astro.formatSecondsToHM(state.rangeEndSec)}`;
    metaSummaryEl.textContent =
      `${state.dateStr} (${rangeLabel}) · ${state.latitude.toFixed(4)}°N, ${state.longitude.toFixed(4)}°E · ${offsetStr} · ${ayanamsaCfg.label}` +
      (state.ayanamsa !== "tropical" ? ` (${ayanamsaDeg.toFixed(2)}°)` : "");

    // Compute full-day exact windows, clipped range windows, and interval rows
    lastWindows = Astro.calculateLagnaWindows(state);
    lastClippedWindows = lastWindows
      .map((w) => clipWindow(w, state.rangeStartSec, state.rangeEndSec))
      .filter(Boolean);
    lastIntervals = Astro.calculateIntervals(state);

    // Update active state of sign pills and reset button
    const hasFilter = selectedSignIndex !== null || selectedNavamshaIndex !== null || state.isCustomRange;
    clearFilterBtn.classList.toggle("hidden", !hasFilter);
    signPillsEl.querySelectorAll(".sign-pill").forEach((el) => {
      const idx = parseInt(el.dataset.signIndex, 10);
      el.classList.toggle("active", selectedSignIndex === idx);
    });

    renderSelectedLagnaSummary(state, lastWindows, lastClippedWindows);
    renderTimeline(state, lastWindows);
    renderWindowsGrid(lastClippedWindows);
    renderIntervalTable(state, lastIntervals);
    syncUrlParams(state);
  }

  function renderSelectedLagnaSummary(state, allWindows, clippedWindows) {
    const rangeStartStr = Astro.formatSecondsToHM(state.rangeStartSec);
    const rangeEndStr = state.rangeEndSec >= 86400 ? "24:00" : Astro.formatSecondsToHM(state.rangeEndSec);

    if (selectedSignIndex === null) {
      const durMin = Math.round(((state.rangeEndSec - state.rangeStartSec) / 60) * 10) / 10;
      const midSec = Math.floor((state.rangeStartSec + state.rangeEndSec) / 2);
      const halfMin = Math.round(((state.rangeEndSec - state.rangeStartSec) / 120) * 10) / 10;
      const candidateSigns = [...new Set(clippedWindows.map((w) => `${w.sign.symbol} ${w.sign.name}`))].join(", ");

      selectedLagnaSummaryEl.innerHTML = `
        <div class="highlight-header">
          <div>
            <strong>Current Search Range</strong>
            <span class="card-sub"> · Select a Lagna sign above to narrow this down</span>
          </div>
          <div class="highlight-time">${Astro.formatSecondsToHMS(state.rangeStartSec)} – ${Astro.formatSecondsToHMS(state.rangeEndSec)}</div>
        </div>
        <div class="range-stats">
          <span class="range-stat-pill">Midpoint: ${Astro.formatSecondsToHMS(midSec)} ± ${halfMin} min</span>
          <span class="range-stat-pill">Span: ${durMin} min</span>
          <span class="range-stat-pill">Possible Lagnas (${clippedWindows.length}): ${candidateSigns}</span>
        </div>
      `;
      return;
    }

    const sign = Astro.ZODIAC_SIGNS[selectedSignIndex];
    const matchingClipped = clippedWindows.filter((w) => w.signIndex === selectedSignIndex);
    const matchingFullDay = allWindows.filter((w) => w.signIndex === selectedSignIndex);

    if (matchingClipped.length === 0) {
      const fullDayInfo = matchingFullDay.length
        ? `On ${state.dateStr}, ${sign.name} (${sign.vedic}) rises during <strong>${matchingFullDay.map((w) => `${w.startTime} – ${w.endTime}`).join(", ")}</strong>.`
        : `This sign does not rise on ${state.dateStr} at this location.`;
      selectedLagnaSummaryEl.innerHTML = `
        <div class="highlight-header">
          <strong>${sign.symbol} ${sign.name} (${sign.vedic}) Lagna</strong>
          <div class="highlight-time">No overlap with ${rangeStartStr} – ${rangeEndStr}</div>
        </div>
        <p class="card-sub">${fullDayInfo}</p>
      `;
      return;
    }

    const blocksHtml = matchingClipped
      .map((w) => {
        const subs = Astro.calculateNavamshaSubWindows({
          ...state,
          startSec: w.startSec,
          endSec: w.endSec,
        });

        // If user also picked a Navamsha (D9) sign, narrow the primary estimated range further!
        const activeSub =
          selectedNavamshaIndex !== null
            ? subs.find((s) => s.navamshaIndex === selectedNavamshaIndex) || null
            : null;

        const targetStartSec = activeSub ? activeSub.startSec : w.startSec;
        const targetEndSec = activeSub ? activeSub.endSec : w.endSec;
        const targetDurMin = Math.round(((targetEndSec - targetStartSec) / 60) * 10) / 10;
        const targetMid = Astro.formatSecondsToHMS(Math.floor((targetStartSec + targetEndSec) / 2));
        const targetHalfMin = Math.round(((targetEndSec - targetStartSec) / 120) * 10) / 10;

        const subsHtml = subs
          .map(
            (s) => `
          <button type="button" class="navamsha-chip ${selectedNavamshaIndex === s.navamshaIndex ? "active" : ""}" data-d9-index="${s.navamshaIndex}">
            <strong>${s.startTime} – ${s.endTime}</strong>
            <span>D9: ${s.navamshaSign.name} (${s.navamshaSign.vedic}) · ${s.durationMinutes}m</span>
          </button>
        `
          )
          .join("");

        return `
          <div style="margin-bottom: 14px;">
            <div class="highlight-header">
              <div>
                <strong>${sign.symbol} ${sign.name} (${sign.vedic}) Lagna${activeSub ? ` + ${activeSub.navamshaSign.name} D9` : ""}</strong>
                <span class="card-sub"> · Ruler: ${sign.ruler}${state.isCustomRange ? ` · Intersected with ${rangeStartStr}–${rangeEndStr}` : ""}</span>
              </div>
              <div class="highlight-time">${Astro.formatSecondsToHMS(targetStartSec)} – ${Astro.formatSecondsToHMS(targetEndSec)}</div>
            </div>
            <div class="range-stats">
              <span class="range-stat-pill">Estimated Midpoint: <strong>${targetMid}</strong> ± ${targetHalfMin} min</span>
              <span class="range-stat-pill">Range Width: ${targetDurMin} min</span>
              ${activeSub ? `<span class="range-stat-pill">Full Lagna Window: ${w.startTime} – ${w.endTime}</span>` : ""}
            </div>
            <div class="card-sub">Click a Navamsha (D9) sub-window below to narrow the range even further (~13 min accuracy):</div>
            <div class="navamsha-grid">${subsHtml}</div>
          </div>
        `;
      })
      .join("");

    selectedLagnaSummaryEl.innerHTML = blocksHtml;

    selectedLagnaSummaryEl.querySelectorAll(".navamsha-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.d9Index, 10);
        selectedNavamshaIndex = selectedNavamshaIndex === idx ? null : idx;
        updateAll();
      });
    });
  }

  function renderTimeline(state, windows) {
    timelineBarEl.innerHTML = "";
    windows.forEach((w) => {
      const pct = ((w.endSec - w.startSec) / 86400) * 100;
      const seg = document.createElement("div");
      seg.className = "timeline-segment";
      if (selectedSignIndex !== null) {
        seg.classList.add(w.signIndex === selectedSignIndex ? "selected" : "dimmed");
      }
      seg.style.width = `${pct}%`;
      seg.style.backgroundColor = w.sign.color;
      seg.title = `${w.sign.name} (${w.sign.vedic}): ${w.startTime} – ${w.endTime} (${w.durationMinutes} min)`;
      seg.setAttribute("role", "listitem");
      seg.textContent = pct >= 6.5 ? w.sign.name.slice(0, 3) : pct >= 3.2 ? w.sign.symbol : "";
      seg.addEventListener("click", () => {
        selectedSignIndex = selectedSignIndex === w.signIndex ? null : w.signIndex;
        selectedNavamshaIndex = null;
        updateAll();
      });
      timelineBarEl.appendChild(seg);
    });

    // Visually highlight the chosen approximate time range on the 24-hour bar
    if (state.isCustomRange) {
      const leftPct = (state.rangeStartSec / 86400) * 100;
      const rightPct = (state.rangeEndSec / 86400) * 100;
      if (leftPct > 0) {
        const leftMask = document.createElement("div");
        leftMask.className = "timeline-range-mask";
        leftMask.style.left = "0%";
        leftMask.style.width = `${leftPct}%`;
        timelineBarEl.appendChild(leftMask);
      }
      if (rightPct < 100) {
        const rightMask = document.createElement("div");
        rightMask.className = "timeline-range-mask";
        rightMask.style.left = `${rightPct}%`;
        rightMask.style.width = `${100 - rightPct}%`;
        timelineBarEl.appendChild(rightMask);
      }
      const frame = document.createElement("div");
      frame.className = "timeline-range-frame";
      frame.style.left = `${leftPct}%`;
      frame.style.width = `${rightPct - leftPct}%`;
      timelineBarEl.appendChild(frame);
    }
  }

  function renderWindowsGrid(clippedWindows) {
    windowsGridEl.innerHTML = "";
    const filtered =
      selectedSignIndex === null
        ? clippedWindows
        : clippedWindows.filter((w) => w.signIndex === selectedSignIndex);

    if (!filtered.length) {
      windowsGridEl.innerHTML = `<p class="card-sub">No Lagna windows match the selected sign within this time range.</p>`;
      return;
    }

    filtered.forEach((w) => {
      const card = document.createElement("div");
      card.className = "window-card" + (selectedSignIndex === w.signIndex ? " selected" : "");
      card.innerHTML = `
        <div class="window-card-top">
          <span class="sign-dot" style="background:${w.sign.color}"></span>
          <span>${w.sign.symbol} ${w.sign.name}</span>
          <span class="sign-pill-vedic">${w.sign.vedic}</span>
        </div>
        <div class="window-card-time">${w.startTime} – ${w.endTime}</div>
        <div class="window-card-meta">Mid ${w.midpointTime} (±${w.plusMinusMin}m) · ${w.durationMinutes} min</div>
      `;
      card.addEventListener("click", () => {
        selectedSignIndex = selectedSignIndex === w.signIndex ? null : w.signIndex;
        selectedNavamshaIndex = null;
        updateAll();
      });
      windowsGridEl.appendChild(card);
    });
  }

  function renderIntervalTable(state, intervals) {
    const filtered = intervals.filter((r) => {
      if (r.seconds < state.rangeStartSec || r.seconds > state.rangeEndSec) return false;
      if (selectedSignIndex !== null && r.signIndex !== selectedSignIndex) return false;
      if (selectedNavamshaIndex !== null && r.navamshaIndex !== selectedNavamshaIndex) return false;
      return true;
    });

    const filterDesc = [];
    if (state.isCustomRange) {
      filterDesc.push(`${Astro.formatSecondsToHM(state.rangeStartSec)}–${state.rangeEndSec >= 86400 ? "24:00" : Astro.formatSecondsToHM(state.rangeEndSec)}`);
    }
    if (selectedSignIndex !== null) filterDesc.push(`${Astro.ZODIAC_SIGNS[selectedSignIndex].name} Lagna`);
    if (selectedNavamshaIndex !== null) filterDesc.push(`${Astro.ZODIAC_SIGNS[selectedNavamshaIndex].name} D9`);

    intervalCountTextEl.textContent = filterDesc.length
      ? `Showing ${filtered.length} intervals (${state.stepMinutes}-min step) matching ${filterDesc.join(" · ")}`
      : `Showing all ${filtered.length} intervals (${state.stepMinutes}-minute step)`;

    const fragment = document.createDocumentFragment();
    filtered.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${r.time}</strong></td>
        <td>
          <span class="sign-cell">
            <span class="sign-dot" style="background:${r.sign.color}"></span>
            ${r.sign.symbol} ${r.sign.name}
          </span>
        </td>
        <td>${r.sign.vedic}</td>
        <td>${r.degInSignFormatted}</td>
        <td>${r.nakshatra} (P${r.pada})</td>
        <td>${r.navamshaSign.name} (${r.navamshaSign.vedic})</td>
      `;
      fragment.appendChild(tr);
    });

    intervalTableBodyEl.innerHTML = "";
    intervalTableBodyEl.appendChild(fragment);
  }

  // City search via OpenStreetMap Nominatim
  async function searchCity() {
    const q = citySearchEl.value.trim();
    if (!q) return;
    searchCityBtn.disabled = true;
    searchCityBtn.textContent = "Searching…";
    searchResultsEl.classList.add("hidden");

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("Lookup failed");
      const items = await res.json();

      searchResultsEl.innerHTML = "";
      if (!items.length) {
        searchResultsEl.innerHTML = `<div class="search-result-item">No matching places found.</div>`;
      } else {
        items.forEach((place) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "search-result-item";
          btn.textContent = place.display_name;
          btn.addEventListener("click", () => {
            latitudeEl.value = parseFloat(place.lat).toFixed(4);
            longitudeEl.value = parseFloat(place.lon).toFixed(4);
            cityPresetEl.value = "custom";
            searchResultsEl.classList.add("hidden");
            showToast("Coordinates updated — check timezone matches location.");
            updateAll();
          });
          searchResultsEl.appendChild(btn);
        });
      }
      searchResultsEl.classList.remove("hidden");
    } catch (_) {
      showToast("City search unavailable offline — enter lat/lon or choose a preset.");
    } finally {
      searchCityBtn.disabled = false;
      searchCityBtn.textContent = "Search";
    }
  }

  // Copy & CSV Export
  function copySummary() {
    if (!lastState || !lastClippedWindows.length) return;
    const lines = [
      `Birth Time Estimator — ${metaSummaryEl.textContent}`,
      "",
      "Estimated Birth Time Ranges:",
      ...lastClippedWindows
        .filter((w) => selectedSignIndex === null || w.signIndex === selectedSignIndex)
        .map(
          (w) =>
            `  ${w.startTime} - ${w.endTime}  ${w.sign.name} (${w.sign.vedic})  [midpoint ${w.midpointTime} +/- ${w.plusMinusMin} min, span ${w.durationMinutes} min]`
        ),
    ];
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Summary copied to clipboard"))
      .catch(() => showToast("Could not access clipboard"));
  }

  function exportCsv() {
    if (!lastState || !lastIntervals.length) return;
    const rows = [
      ["Local Time", "UTC ISO", "Lagna Sign", "Vedic Name", "Degree in Sign", "Nakshatra", "Pada", "Navamsha (D9)"],
      ...lastIntervals
        .filter((r) => {
          if (r.seconds < lastState.rangeStartSec || r.seconds > lastState.rangeEndSec) return false;
          if (selectedSignIndex !== null && r.signIndex !== selectedSignIndex) return false;
          if (selectedNavamshaIndex !== null && r.navamshaIndex !== selectedNavamshaIndex) return false;
          return true;
        })
        .map((r) => [
          r.time,
          r.utcISO,
          r.sign.name,
          r.sign.vedic,
          r.degInSignFormatted,
          r.nakshatra,
          r.pada,
          `${r.navamshaSign.name} (${r.navamshaSign.vedic})`,
        ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lagna-${lastState.dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Theme handling
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bte-theme", theme);
    if (theme === "light") {
      themeIconEl.textContent = "🌙";
      themeLabelEl.textContent = "Dark";
    } else {
      themeIconEl.textContent = "☀️";
      themeLabelEl.textContent = "Light";
    }
  }

  // Wire up events
  cityPresetEl.addEventListener("change", () => {
    if (cityPresetEl.value === "custom") return;
    const [lat, lon, tz] = cityPresetEl.value.split(",");
    latitudeEl.value = lat;
    longitudeEl.value = lon;
    timezoneEl.value = tz;
    useManualOffsetEl.checked = false;
    manualOffsetEl.disabled = true;
    updateAll();
  });

  [latitudeEl, longitudeEl].forEach((el) => {
    el.addEventListener("input", () => {
      cityPresetEl.value = "custom";
      updateAll();
    });
  });

  [birthDateEl, timezoneEl, ayanamsaEl, stepMinutesEl, manualOffsetEl].forEach((el) => {
    el.addEventListener("change", updateAll);
    el.addEventListener("input", updateAll);
  });

  rangeStartEl.addEventListener("change", updateAll);
  rangeStartEl.addEventListener("input", updateAll);
  rangeEndEl.addEventListener("change", () => {
    rangeEndIsMidnight = false;
    updateAll();
  });
  rangeEndEl.addEventListener("input", () => {
    rangeEndIsMidnight = false;
    updateAll();
  });

  rangePresetsEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      rangeStartEl.value = btn.dataset.start;
      if (btn.dataset.end === "24:00") {
        rangeEndEl.value = "23:59";
        rangeEndIsMidnight = true;
      } else {
        rangeEndEl.value = btn.dataset.end;
        rangeEndIsMidnight = false;
      }
      updateAll();
    });
  });

  useManualOffsetEl.addEventListener("change", () => {
    manualOffsetEl.disabled = !useManualOffsetEl.checked;
    updateAll();
  });

  clearFilterBtn.addEventListener("click", () => {
    selectedSignIndex = null;
    selectedNavamshaIndex = null;
    rangeStartEl.value = "00:00";
    rangeEndEl.value = "23:59";
    rangeEndIsMidnight = true;
    updateAll();
  });

  searchCityBtn.addEventListener("click", searchCity);
  citySearchEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchCity();
    }
  });
  document.addEventListener("click", (e) => {
    if (!searchResultsEl.contains(e.target) && e.target !== citySearchEl && e.target !== searchCityBtn) {
      searchResultsEl.classList.add("hidden");
    }
  });

  copySummaryBtn.addEventListener("click", copySummary);
  exportCsvBtn.addEventListener("click", exportCsv);

  themeToggleBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // Init
  populateTimezones();
  renderSignPills();
  applyTheme(localStorage.getItem("bte-theme") || "dark");
  applyUrlParams();
  updateAll();
})();
