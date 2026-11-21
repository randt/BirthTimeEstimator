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

  let selectedSignIndex = null; // null = show all
  let lastState = null;
  let lastWindows = [];
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
        selectedSignIndex = selectedSignIndex === sign.index ? null : sign.index;
        updateAll();
      });
      signPillsEl.appendChild(btn);
    });
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
    };
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
    if (params.has("lagna")) {
      const q = params.get("lagna").toLowerCase();
      const match = Astro.ZODIAC_SIGNS.find(
        (s) => s.name.toLowerCase() === q || s.vedic.toLowerCase() === q
      );
      if (match) selectedSignIndex = match.index;
    }
  }

  function updateAll() {
    const state = readStateFromInputs();
    if (!state.year || !state.month || !state.day) return;

    lastState = state;

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
    metaSummaryEl.textContent =
      `${state.dateStr} · ${state.latitude.toFixed(4)}°N, ${state.longitude.toFixed(4)}°E · ${offsetStr} · ${ayanamsaCfg.label}` +
      (state.ayanamsa !== "tropical" ? ` (${ayanamsaDeg.toFixed(2)}°)` : "");

    // Compute exact windows and interval rows
    lastWindows = Astro.calculateLagnaWindows(state);
    lastIntervals = Astro.calculateIntervals(state);

    // Update active state of sign pills
    clearFilterBtn.classList.toggle("hidden", selectedSignIndex === null);
    signPillsEl.querySelectorAll(".sign-pill").forEach((el) => {
      const idx = parseInt(el.dataset.signIndex, 10);
      el.classList.toggle("active", selectedSignIndex === idx);
    });

    renderSelectedLagnaSummary(state, lastWindows);
    renderTimeline(lastWindows);
    renderWindowsGrid(lastWindows);
    renderIntervalTable(lastIntervals);
    syncUrlParams(state);
  }

  function renderSelectedLagnaSummary(state, windows) {
    if (selectedSignIndex === null) {
      selectedLagnaSummaryEl.classList.add("hidden");
      selectedLagnaSummaryEl.innerHTML = "";
      return;
    }

    const sign = Astro.ZODIAC_SIGNS[selectedSignIndex];
    const matching = windows.filter((w) => w.signIndex === selectedSignIndex);
    selectedLagnaSummaryEl.classList.remove("hidden");

    if (matching.length === 0) {
      selectedLagnaSummaryEl.innerHTML = `
        <div class="highlight-header">
          <strong>${sign.symbol} ${sign.name} (${sign.vedic}) Lagna</strong>
        </div>
        <p class="card-sub">This sign does not rise on this date at this location.</p>
      `;
      return;
    }

    const blocksHtml = matching
      .map((w) => {
        const subs = Astro.calculateNavamshaSubWindows({
          ...state,
          startSec: w.startSec,
          endSec: w.endSec,
        });
        const subsHtml = subs
          .map(
            (s) => `
          <div class="navamsha-chip">
            <strong>${s.startTime} – ${s.endTime}</strong>
            <span>D9: ${s.navamshaSign.name} (${s.navamshaSign.vedic}) · ${s.durationMinutes}m</span>
          </div>
        `
          )
          .join("");

        return `
          <div style="margin-bottom: 12px;">
            <div class="highlight-header">
              <div>
                <strong>${sign.symbol} ${sign.name} (${sign.vedic}) Lagna</strong>
                <span class="card-sub"> · Ruler: ${sign.ruler} · ${w.durationMinutes} min window</span>
              </div>
              <div class="highlight-time">${w.startTime} – ${w.endTime}</div>
            </div>
            <div class="card-sub">Navamsha (D9) sub-windows inside this Lagna (~13 min each):</div>
            <div class="navamsha-grid">${subsHtml}</div>
          </div>
        `;
      })
      .join("");

    selectedLagnaSummaryEl.innerHTML = blocksHtml;
  }

  function renderTimeline(windows) {
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
        updateAll();
      });
      timelineBarEl.appendChild(seg);
    });
  }

  function renderWindowsGrid(windows) {
    windowsGridEl.innerHTML = "";
    const filtered =
      selectedSignIndex === null
        ? windows
        : windows.filter((w) => w.signIndex === selectedSignIndex);

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
        <div class="window-card-meta">${w.durationMinutes} min · Ruler: ${w.sign.ruler}</div>
      `;
      card.addEventListener("click", () => {
        selectedSignIndex = selectedSignIndex === w.signIndex ? null : w.signIndex;
        updateAll();
      });
      windowsGridEl.appendChild(card);
    });
  }

  function renderIntervalTable(intervals) {
    const filtered =
      selectedSignIndex === null
        ? intervals
        : intervals.filter((r) => r.signIndex === selectedSignIndex);

    intervalCountTextEl.textContent =
      selectedSignIndex === null
        ? `Showing all ${filtered.length} intervals (${lastState.stepMinutes}-minute step)`
        : `Showing ${filtered.length} intervals matching ${Astro.ZODIAC_SIGNS[selectedSignIndex].name} Lagna`;

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
    if (!lastState || !lastWindows.length) return;
    const lines = [
      `Birth Time Estimator — ${metaSummaryEl.textContent}`,
      "",
      "Lagna Windows:",
      ...lastWindows
        .filter((w) => selectedSignIndex === null || w.signIndex === selectedSignIndex)
        .map((w) => `  ${w.startTime} - ${w.endTime}  ${w.sign.name} (${w.sign.vedic}) [${w.durationMinutes} min]`),
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
        .filter((r) => selectedSignIndex === null || r.signIndex === selectedSignIndex)
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

  useManualOffsetEl.addEventListener("change", () => {
    manualOffsetEl.disabled = !useManualOffsetEl.checked;
    updateAll();
  });

  clearFilterBtn.addEventListener("click", () => {
    selectedSignIndex = null;
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
