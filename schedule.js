const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/11tZmB2rW0udWs4-X7QxmxGKTtvQ1aN14/export?format=csv";
const LOCAL_CSV_URL = "schedule-data.csv";

const CATEGORY_META = {
  all: { label: "전체", className: "cat-default" },
  exam: { label: "시험", className: "cat-exam" },
  grade: { label: "성적", className: "cat-grade" },
  vacation: { label: "방학·보강", className: "cat-vacation" },
  semester: { label: "계절학기", className: "cat-semester" },
  registration: { label: "신청", className: "cat-registration" },
  leave: { label: "휴·복학", className: "cat-leave" },
};

const FALLBACK_EVENTS = [
  { start: "2026-06-09", end: "2026-06-15", title: "기말고사" },
  { start: "2026-06-16", end: "2026-06-22", title: "보강기간" },
  { start: "2026-06-22", end: "2026-07-03", title: "재입학 신청기간" },
  { start: "2026-06-23", end: "2026-07-06", title: "하계 계절학기" },
  { start: "2026-06-23", end: "2026-08-31", title: "미등록 휴학기간" },
  { start: "2026-06-23", end: "2026-06-23", title: "하계방학" },
  { start: "2026-06-25", end: "2026-06-30", title: "성적공시 및 정정" },
  { start: "2026-07-13", end: "2026-08-31", title: "휴학연기 신청기간" },
  { start: "2026-07-13", end: "2026-07-17", title: "복학기간" },
  { start: "2026-07-29", end: "2026-07-31", title: "예비수강 신청기간" },
];

let allEvents = [];
let filteredEvents = [];
let viewYear;
let viewMonth;
let selectedDate;
let activeCategory = "all";
let searchQuery = "";

const els = {
  statToday: document.getElementById("stat-today"),
  statWeek: document.getElementById("stat-week"),
  statMonth: document.getElementById("stat-month"),
  statTotal: document.getElementById("stat-total"),
  currentMonth: document.getElementById("current-month"),
  calendarGrid: document.getElementById("calendar-grid"),
  dayList: document.getElementById("day-list"),
  upcomingList: document.getElementById("upcoming-list"),
  timelineList: document.getElementById("timeline-list"),
  selectedDateTitle: document.getElementById("selected-date-title"),
  categoryFilters: document.getElementById("category-filters"),
  searchInput: document.getElementById("search-input"),
  csvUpload: document.getElementById("csv-upload"),
  reloadBtn: document.getElementById("reload-btn"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  todayBtn: document.getElementById("today-btn"),
};

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(date, start, end) {
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  return t >= s && t <= e;
}

function categorize(title) {
  if (/고사/.test(title)) return "exam";
  if (/성적/.test(title)) return "grade";
  if (/방학|보강/.test(title)) return "vacation";
  if (/계절학기/.test(title)) return "semester";
  if (/신청|수강|재입학/.test(title)) return "registration";
  if (/휴학|복학/.test(title)) return "leave";
  return "default";
}

function durationDays(start, end) {
  const ms = end - start;
  return Math.floor(ms / 86400000) + 1;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const startIdx = headers.indexOf("start");
  const endIdx = headers.indexOf("end");
  const titleIdx = headers.indexOf("title");

  if (startIdx === -1 || endIdx === -1 || titleIdx === -1) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = line.split(",");
    const start = cols[startIdx]?.trim();
    const end = cols[endIdx]?.trim();
    const title = cols.slice(titleIdx).join(",").trim();
    if (!start || !end || !title) return [];
    return [{ start, end, title }];
  });
}

function enrichEvents(events) {
  return events.map((event) => {
    const start = parseDate(event.start);
    const end = parseDate(event.end);
    const category = categorize(event.title);
    return {
      ...event,
      startDate: start,
      endDate: end,
      category,
      days: durationDays(start, end),
    };
  });
}

function applyFilters() {
  filteredEvents = allEvents.filter((event) => {
    const matchCategory =
      activeCategory === "all" || event.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });
}

function getEventsOnDate(date) {
  return filteredEvents.filter((event) =>
    isBetween(new Date(date), new Date(event.startDate), new Date(event.endDate))
  );
}

function countEventsInRange(start, end) {
  return filteredEvents.filter((event) => {
    const eventStart = event.startDate.getTime();
    const eventEnd = event.endDate.getTime();
    return eventEnd >= start.getTime() && eventStart <= end.getTime();
  }).length;
}

function renderCategoryFilters() {
  els.categoryFilters.innerHTML = Object.entries(CATEGORY_META)
    .map(
      ([key, meta]) =>
        `<button type="button" class="chip${key === activeCategory ? " active" : ""}" data-cat="${key}">${meta.label}</button>`
    )
    .join("");

  els.categoryFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.cat;
      renderCategoryFilters();
      renderAll();
    });
  });
}

function renderStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  els.statToday.textContent = getEventsOnDate(today).length;
  els.statWeek.textContent = countEventsInRange(weekStart, weekEnd);
  els.statMonth.textContent = countEventsInRange(monthStart, monthEnd);
  els.statTotal.textContent = filteredEvents.length;
}

function renderCalendar() {
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startOffset = firstDay.getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  els.currentMonth.textContent = `${viewYear}년 ${viewMonth + 1}월`;

  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="day-cell empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(viewYear, viewMonth, day);
    const events = getEventsOnDate(date);
    const isToday = sameDay(date, today);
    const isSelected = sameDay(date, selectedDate);
    const weekday = date.getDay();
    const classes = [
      "day-cell",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
      weekday === 0 ? "sunday" : "",
      weekday === 6 ? "saturday" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const dots = events
      .slice(0, 4)
      .map((event) => {
        const cat = event.category === "default" ? "default" : event.category;
        return `<span class="dot cat-${cat}" title="${event.title}"></span>`;
      })
      .join("");

    cells.push(`
      <button type="button" class="${classes}" data-date="${formatDate(date)}" role="gridcell" aria-label="${formatDate(date)} ${events.length}건">
        <span class="day-num">${day}</span>
        <span class="day-dots">${dots}</span>
      </button>
    `);
  }

  els.calendarGrid.innerHTML = cells.join("");

  els.calendarGrid.querySelectorAll(".day-cell:not(.empty)").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedDate = parseDate(cell.dataset.date);
      renderAll();
    });
  });
}

function formatRange(start, end) {
  const same = formatDate(start) === formatDate(end);
  if (same) return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function renderEventItem(event) {
  const cat = event.category === "default" ? "default" : event.category;
  const meta = CATEGORY_META[cat] || CATEGORY_META.all;
  return `
    <li class="event-item">
      <div class="event-item-head">
        <span class="badge ${meta.className}">${meta.label}</span>
        <h4>${event.title}</h4>
      </div>
      <span class="range">${formatRange(event.startDate, event.endDate)} · ${event.days}일</span>
    </li>
  `;
}

function renderDayList() {
  const events = getEventsOnDate(selectedDate);
  els.selectedDateTitle.textContent = `${formatDisplayDate(selectedDate)} 일정`;

  if (!events.length) {
    els.dayList.innerHTML =
      '<li class="empty-state">선택한 날짜에 일정이 없습니다.</li>';
    return;
  }

  els.dayList.innerHTML = events.map(renderEventItem).join("");
}

function renderUpcoming() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 14);

  const upcoming = filteredEvents
    .filter((event) => event.endDate >= today && event.startDate <= horizon)
    .sort((a, b) => a.startDate - b.startDate);

  if (!upcoming.length) {
    els.upcomingList.innerHTML =
      '<li class="empty-state">앞으로 14일 내 예정된 일정이 없습니다.</li>';
    return;
  }

  els.upcomingList.innerHTML = upcoming.map(renderEventItem).join("");
}

function renderTimeline() {
  if (!filteredEvents.length) {
    els.timelineList.innerHTML =
      '<div class="empty-state">표시할 일정이 없습니다.</div>';
    return;
  }

  const sorted = [...filteredEvents].sort((a, b) => a.startDate - b.startDate);
  const minDate = sorted[0].startDate;
  const maxDate = sorted[sorted.length - 1].endDate;
  const totalSpan = maxDate - minDate || 1;

  els.timelineList.innerHTML = sorted
    .map((event) => {
      const cat = event.category === "default" ? "default" : event.category;
      const left = ((event.startDate - minDate) / totalSpan) * 100;
      const width = Math.max(((event.endDate - event.startDate) / totalSpan) * 100, 1.5);
      return `
        <div class="timeline-row">
          <div class="timeline-dates">${formatRange(event.startDate, event.endDate)}</div>
          <div>
            <div class="timeline-title">${event.title}</div>
            <div class="timeline-bar-wrap" aria-hidden="true">
              <span class="timeline-bar cat-${cat}" style="left:${left}%; width:${width}%"></span>
            </div>
          </div>
          <div class="timeline-days">${event.days}일</div>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  applyFilters();
  renderStats();
  renderCalendar();
  renderDayList();
  renderUpcoming();
  renderTimeline();
}

async function loadEventsFromText(text) {
  const parsed = parseCSV(text);
  allEvents = enrichEvents(parsed.length ? parsed : FALLBACK_EVENTS);
  renderAll();
}

async function loadEvents() {
  const sources = [LOCAL_CSV_URL, SHEET_CSV_URL];

  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.length) {
        allEvents = enrichEvents(parsed);
        renderAll();
        return;
      }
    } catch {
      /* try next source */
    }
  }

  allEvents = enrichEvents(FALLBACK_EVENTS);
  renderAll();
}

function initControls() {
  els.prevMonth.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  els.todayBtn.addEventListener("click", () => {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectedDate = new Date(today);
    selectedDate.setHours(0, 0, 0, 0);
    renderAll();
  });

  els.searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderAll();
  });

  els.reloadBtn.addEventListener("click", loadEvents);

  els.csvUpload.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await loadEventsFromText(text);
    e.target.value = "";
  });
}

function init() {
  const today = new Date();
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  selectedDate = new Date(today);
  selectedDate.setHours(0, 0, 0, 0);

  renderCategoryFilters();
  initControls();
  loadEvents();
}

init();
