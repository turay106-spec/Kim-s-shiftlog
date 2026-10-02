const STORAGE_KEY = "shiftlog_shifts_v1";
const ACTIVE_SHIFT_KEY = "shiftlog_active_shift_v1";
const ACTIVE_SESSION_KEY = "shiftlog_active_session_v2";
const SETTINGS_KEY = "shiftlog_settings_v2";
const JOBS_KEY = "shiftlog_jobs_v2";

const DEFAULT_JOB = {
  id: "job-general",
  name: "General",
  rate: 0,
  archived: false,
};

const DEFAULT_SETTINGS = {
  currency: "GBP",
  defaultJobId: DEFAULT_JOB.id,
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let jobs = loadJobs();
let settings = loadSettings();
ensureSettingsAreValid();
let shifts = loadShifts();
let activeSession = loadActiveSession();

let clockTimerInterval = null;
let clockActionLocked = false;
let installPrompt = null;
let toastTimer = null;

const form = $("shiftForm");
const dateInput = $("date");
const timeInInput = $("timeIn");
const timeOutInput = $("timeOut");
const breakInput = $("breakMinutes");
const noteInput = $("note");
const editIdInput = $("editId");
const jobInput = $("jobId");
const saveBtn = $("saveBtn");
const cancelEditBtn = $("cancelEditBtn");
const formMessage = $("formMessage");

const clockButton = $("clockButton");
const clockStatus = $("clockStatus");
const clockTitle = $("clockTitle");
const clockJob = $("clockJob");
const liveTimer = $("liveTimer");
const liveEarnings = $("liveEarnings");

const dashboardPeriod = $("dashboardPeriod");
const dashboardDate = $("dashboardDate");
const dashboardDateWrap = $("dashboardDateWrap");
const dashboardJob = $("dashboardJob");

const exportPeriod = $("exportPeriod");
const exportDate = $("exportDate");
const exportDateWrap = $("exportDateWrap");
const exportJob = $("exportJob");
const exportFormat = $("exportFormat");
const createExportBtn = $("createExportBtn");

const currencySelect = $("currency");
const defaultJobSelect = $("defaultJob");
const jobForm = $("jobForm");
const jobEditId = $("jobEditId");
const jobNameInput = $("jobName");
const jobRateInput = $("jobRate");
const saveJobBtn = $("saveJobBtn");
const cancelJobEditBtn = $("cancelJobEditBtn");

dateInput.value = localDateKey();
dashboardDate.value = localDateKey();
exportDate.value = localDateKey();
currencySelect.value = settings.currency;

renderAll();
renderClockState();
updateConnectionStatus();
navigateFromHash();

function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateLabel(dateString, options = {}) {
  const date = dateFromKey(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: options.weekday ?? "short",
    day: "numeric",
    month: options.month ?? "short",
    year: "numeric",
  }).format(date);
}

function shortDateLabel(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateFromKey(dateString));
}

function minutesBetween(timeIn, timeOut) {
  const [inHour, inMinute] = timeIn.split(":").map(Number);
  const [outHour, outMinute] = timeOut.split(":").map(Number);
  const start = inHour * 60 + inMinute;
  let end = outHour * 60 + outMinute;
  if (end < start) end += 24 * 60;
  return end - start;
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMoney(amount) {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: settings.currency || "GBP",
    }).format(value);
  } catch {
    return `${settings.currency || "GBP"} ${value.toFixed(2)}`;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

function sanitizeFilePart(value) {
  return String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";
}

function loadJobs() {
  try {
    const saved = JSON.parse(localStorage.getItem(JOBS_KEY) || "null");
    if (!Array.isArray(saved) || !saved.length) return [{ ...DEFAULT_JOB }];

    return saved.map((job) => ({
      id: String(job.id || makeId()),
      name: String(job.name || "Untitled job"),
      rate: Math.max(0, Number(job.rate) || 0),
      archived: Boolean(job.archived),
    }));
  } catch {
    return [{ ...DEFAULT_JOB }];
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function ensureSettingsAreValid() {
  const activeJobs = jobs.filter((job) => !job.archived);
  if (!activeJobs.length) {
    jobs = [{ ...DEFAULT_JOB }];
  }

  const currentDefault = jobs.find(
    (job) => job.id === settings.defaultJobId && !job.archived,
  );

  if (!currentDefault) {
    settings.defaultJobId =
      jobs.find((job) => !job.archived)?.id || DEFAULT_JOB.id;
  }

  if (!["GBP", "USD", "EUR", "SLE"].includes(settings.currency)) {
    settings.currency = "GBP";
  }
}

function loadShifts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];

    return saved
      .filter((shift) => shift && shift.date && shift.timeIn && shift.timeOut)
      .map((shift) => {
        const grossMinutes = Math.max(
          0,
          Number(
            shift.grossMinutes ??
              shift.minutes ??
              minutesBetween(shift.timeIn, shift.timeOut),
          ) || 0,
        );

        const breakMinutes = Math.max(0, Number(shift.breakMinutes) || 0);
        const paidMinutes = Math.max(
          0,
          Number(shift.minutes ?? grossMinutes - breakMinutes) || 0,
        );

        return {
          ...shift,
          id: String(shift.id || makeId()),
          jobId: String(shift.jobId || settings.defaultJobId),
          grossMinutes,
          breakMinutes,
          minutes: paidMinutes,
          hourlyRate:
            shift.hourlyRate === null || shift.hourlyRate === undefined
              ? null
              : Math.max(0, Number(shift.hourlyRate) || 0),
          note: String(shift.note || ""),
          source: String(shift.source || "legacy"),
          createdAt: shift.createdAt || null,
        };
      });
  } catch {
    return [];
  }
}

function loadActiveSession() {
  try {
    const modern = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || "null");
    if (modern?.startedAt) {
      const startedAt = new Date(modern.startedAt);
      if (!Number.isNaN(startedAt.getTime())) {
        return {
          startedAt: startedAt.toISOString(),
          jobId: String(modern.jobId || settings.defaultJobId),
        };
      }
    }
  } catch {
    // Fall through to legacy storage.
  }

  const legacy = localStorage.getItem(ACTIVE_SHIFT_KEY);
  if (!legacy) return null;

  const legacyDate = new Date(legacy);
  if (Number.isNaN(legacyDate.getTime())) return null;

  return {
    startedAt: legacyDate.toISOString(),
    jobId: settings.defaultJobId,
  };
}

function saveShifts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
}

function saveJobs() {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

function saveSettings() {
  ensureSettingsAreValid();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function saveActiveSession() {
  if (!activeSession) return;
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession));

  // Keep the original key too, so an older ShiftLog build still understands
  // when the shift began during a staged upgrade.
  localStorage.setItem(ACTIVE_SHIFT_KEY, activeSession.startedAt);
}

function clearActiveSession() {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  localStorage.removeItem(ACTIVE_SHIFT_KEY);
}

function getJob(jobId) {
  return jobs.find((job) => job.id === jobId) || null;
}

function activeJobs() {
  return jobs.filter((job) => !job.archived);
}

function getShiftRate(shift) {
  if (shift.hourlyRate !== null && shift.hourlyRate !== undefined) {
    return Math.max(0, Number(shift.hourlyRate) || 0);
  }
  return Math.max(0, Number(getJob(shift.jobId)?.rate) || 0);
}

function getShiftEarnings(shift) {
  return (Math.max(0, Number(shift.minutes) || 0) / 60) * getShiftRate(shift);
}

function getPeriodRange(period, chosenDate = localDateKey()) {
  if (period === "all") {
    return {
      startKey: null,
      endKey: null,
      label: "All time",
      fileLabel: "all-time",
    };
  }

  const date = dateFromKey(chosenDate);

  if (period === "week") {
    const dayOfWeek = date.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - daysSinceMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startKey = localDateKey(start);
    const endKey = localDateKey(end);

    return {
      startKey,
      endKey,
      label: `${dateLabel(startKey, { weekday: undefined, month: "short" })} – ${dateLabel(endKey, { weekday: undefined, month: "short" })}`,
      fileLabel: `week-${startKey}`,
    };
  }

  if (period === "month") {
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return {
      startKey: localDateKey(start),
      endKey: localDateKey(end),
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(date),
      fileLabel: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    };
  }

  const year = date.getFullYear();
  return {
    startKey: `${year}-01-01`,
    endKey: `${year}-12-31`,
    label: String(year),
    fileLabel: String(year),
  };
}

function getFilteredShifts({
  period = "month",
  dateKey = localDateKey(),
  jobId = "all",
} = {}) {
  const range = getPeriodRange(period, dateKey);

  return shifts.filter((shift) => {
    const insidePeriod =
      !range.startKey ||
      (shift.date >= range.startKey && shift.date <= range.endKey);

    const matchesJob = jobId === "all" || shift.jobId === jobId;

    return insidePeriod && matchesJob;
  });
}

function getSummary(reportShifts) {
  const totalMinutes = reportShifts.reduce(
    (sum, shift) => sum + Math.max(0, Number(shift.minutes) || 0),
    0,
  );

  const earnings = reportShifts.reduce(
    (sum, shift) => sum + getShiftEarnings(shift),
    0,
  );

  return {
    totalMinutes,
    earnings,
    count: reportShifts.length,
    averageMinutes: reportShifts.length
      ? Math.round(totalMinutes / reportShifts.length)
      : 0,
  };
}

function renderAll() {
  ensureSettingsAreValid();
  saveJobs();
  saveSettings();
  renderJobOptions();
  renderDashboard();
  renderShiftList();
  renderJobs();
  renderSettings();
  renderReportPreview();
}

function renderJobOptions() {
  const allJobOptions = jobs
    .map(
      (job) =>
        `<option value="${escapeHtml(job.id)}"${job.archived ? " disabled" : ""}>${escapeHtml(job.name)}${job.archived ? " (archived)" : ""}</option>`,
    )
    .join("");

  const activeJobOptions = activeJobs()
    .map(
      (job) =>
        `<option value="${escapeHtml(job.id)}">${escapeHtml(job.name)}</option>`,
    )
    .join("");

  const filterOptions = jobs
    .map(
      (job) =>
        `<option value="${escapeHtml(job.id)}">${escapeHtml(job.name)}${job.archived ? " (archived)" : ""}</option>`,
    )
    .join("");

  const previousFormJob = jobInput.value;
  const previousClockJob = clockJob.value;
  const previousDashboardJob = dashboardJob.value;
  const previousHistoryJob = $("historyJob").value;
  const previousExportJob = exportJob.value;

  jobInput.innerHTML = allJobOptions;
  clockJob.innerHTML = activeJobOptions;
  defaultJobSelect.innerHTML = activeJobOptions;

  dashboardJob.innerHTML = `<option value="all">All jobs</option>${filterOptions}`;
  $("historyJob").innerHTML =
    `<option value="all">All jobs</option>${filterOptions}`;
  exportJob.innerHTML = `<option value="all">All jobs</option>${filterOptions}`;

  jobInput.value =
    previousFormJob && jobs.some((job) => job.id === previousFormJob)
      ? previousFormJob
      : settings.defaultJobId;

  clockJob.value =
    activeSession?.jobId && activeJobs().some((job) => job.id === activeSession.jobId)
      ? activeSession.jobId
      : previousClockJob &&
          activeJobs().some((job) => job.id === previousClockJob)
        ? previousClockJob
        : settings.defaultJobId;

  dashboardJob.value =
    previousDashboardJob &&
    (previousDashboardJob === "all" ||
      jobs.some((job) => job.id === previousDashboardJob))
      ? previousDashboardJob
      : "all";

  $("historyJob").value =
    previousHistoryJob &&
    (previousHistoryJob === "all" ||
      jobs.some((job) => job.id === previousHistoryJob))
      ? previousHistoryJob
      : "all";

  exportJob.value =
    previousExportJob &&
    (previousExportJob === "all" ||
      jobs.some((job) => job.id === previousExportJob))
      ? previousExportJob
      : "all";

  defaultJobSelect.value = settings.defaultJobId;
}

function renderDashboard() {
  const period = dashboardPeriod.value;
  const dateKey = dashboardDate.value || localDateKey();
  const jobId = dashboardJob.value || "all";
  const reportShifts = getFilteredShifts({ period, dateKey, jobId });
  const summary = getSummary(reportShifts);
  const range = getPeriodRange(period, dateKey);

  dashboardDateWrap.classList.toggle("hidden", period === "all");

  $("periodHours").textContent = formatDuration(summary.totalMinutes);
  $("heroPeriodLabel").textContent =
    period === "all"
      ? "All recorded hours"
      : `${period.charAt(0).toUpperCase()}${period.slice(1)} total`;
  $("heroDateLabel").textContent =
    jobId === "all"
      ? range.label
      : `${range.label} · ${getJob(jobId)?.name || "Job"}`;

  $("statHours").textContent = formatDuration(summary.totalMinutes);
  $("statShifts").textContent = summary.count;
  $("statEarnings").textContent = formatMoney(summary.earnings);
  $("statAverage").textContent = formatDuration(summary.averageMinutes);

  const recent = [...reportShifts]
    .sort(compareShiftsDescending)
    .slice(0, 3);

  $("dashboardRecent").innerHTML = recent.length
    ? recent.map((shift) => shiftCardHtml(shift, false)).join("")
    : '<div class="empty">No shifts in this period yet.</div>';
}

function renderShiftList() {
  const searchTerm = $("historySearch").value.trim().toLowerCase();
  const selectedJob = $("historyJob").value || "all";
  const selectedMonth = $("historyMonth").value;

  const filtered = [...shifts]
    .filter((shift) => {
      const job = getJob(shift.jobId);
      const haystack = [
        shift.note,
        shift.date,
        shift.timeIn,
        shift.timeOut,
        job?.name,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesJob =
        selectedJob === "all" || shift.jobId === selectedJob;
      const matchesMonth =
        !selectedMonth || shift.date.startsWith(selectedMonth);

      return matchesSearch && matchesJob && matchesMonth;
    })
    .sort(compareShiftsDescending);

  $("shiftList").innerHTML = filtered.length
    ? filtered.map((shift) => shiftCardHtml(shift, true)).join("")
    : '<div class="empty">No shifts match these filters.</div>';
}

function compareShiftsDescending(a, b) {
  return `${b.date}${b.timeIn}`.localeCompare(`${a.date}${a.timeIn}`);
}

function compareShiftsAscending(a, b) {
  return `${a.date}${a.timeIn}`.localeCompare(`${b.date}${b.timeIn}`);
}

function shiftCardHtml(shift, withActions = true) {
  const job = getJob(shift.jobId);
  const breakText =
    shift.breakMinutes > 0 ? ` · ${shift.breakMinutes}m break` : "";
  const overnightText = shift.timeOut < shift.timeIn ? " · overnight" : "";

  return `
    <article class="shift-card">
      <div>
        <div class="shift-date">${escapeHtml(dateLabel(shift.date))}</div>
        <div class="shift-time">${escapeHtml(shift.timeIn)} – ${escapeHtml(shift.timeOut)}${overnightText}${breakText}</div>
        <span class="shift-job">${escapeHtml(job?.name || "Unassigned")}</span>
        ${shift.note ? `<div class="shift-note">${escapeHtml(shift.note)}</div>` : ""}
      </div>

      <div>
        <div class="shift-duration">${formatDuration(shift.minutes)}</div>
        <div class="shift-earnings">${formatMoney(getShiftEarnings(shift))}</div>
      </div>

      ${
        withActions
          ? `<div class="card-actions">
              <button class="small-btn" type="button" data-action="edit" data-id="${escapeHtml(shift.id)}">Edit</button>
              <button class="small-btn" type="button" data-action="duplicate" data-id="${escapeHtml(shift.id)}">Duplicate</button>
              <button class="small-btn delete" type="button" data-action="delete" data-id="${escapeHtml(shift.id)}">Delete</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderClockState() {
  if (!activeSession) {
    stopLiveTimer();
    clockTitle.textContent = "Ready to start?";
    clockStatus.textContent = "You're currently clocked out.";
    liveTimer.classList.add("hidden");
    liveEarnings.classList.add("hidden");
    clockButton.textContent = "CLOCK IN";
    clockButton.classList.remove("clock-out");
    clockJob.disabled = false;
    clockJob.value = settings.defaultJobId;
    return;
  }

  const start = new Date(activeSession.startedAt);
  const job = getJob(activeSession.jobId);

  clockTitle.textContent = "Shift in progress";
  clockStatus.textContent = `Started ${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} · ${job?.name || "Job"}`;
  clockJob.value = activeSession.jobId;
  clockJob.disabled = true;
  liveTimer.classList.remove("hidden");
  liveEarnings.classList.remove("hidden");
  clockButton.textContent = "CLOCK OUT";
  clockButton.classList.add("clock-out");

  startLiveTimer();
}

function startLiveTimer() {
  stopLiveTimer();
  updateLiveTimer();
  clockTimerInterval = window.setInterval(updateLiveTimer, 1000);
}

function stopLiveTimer() {
  if (clockTimerInterval !== null) {
    window.clearInterval(clockTimerInterval);
    clockTimerInterval = null;
  }
}

function updateLiveTimer() {
  if (!activeSession) return;

  const startedAt = new Date(activeSession.startedAt);
  const millisecondsWorked = Date.now() - startedAt.getTime();
  liveTimer.textContent = formatElapsedTime(millisecondsWorked);

  const rate = Math.max(0, Number(getJob(activeSession.jobId)?.rate) || 0);
  const estimatedEarnings = (millisecondsWorked / 3600000) * rate;
  liveEarnings.textContent = `Estimated: ${formatMoney(estimatedEarnings)}`;
}

function renderSettings() {
  currencySelect.value = settings.currency;
  defaultJobSelect.value = settings.defaultJobId;
}

function renderJobs() {
  $("jobList").innerHTML = jobs
    .map(
      (job) => `
        <div class="job-row${job.archived ? " archived" : ""}">
          <div>
            <strong>${escapeHtml(job.name)}</strong>
            <p>${formatMoney(job.rate)} / hour${job.id === settings.defaultJobId ? " · default" : ""}${job.archived ? " · archived" : ""}</p>
          </div>
          <div class="job-actions">
            <button class="small-btn" type="button" data-job-action="edit" data-id="${escapeHtml(job.id)}">Edit</button>
            <button class="small-btn${job.archived ? "" : " delete"}" type="button" data-job-action="archive" data-id="${escapeHtml(job.id)}">${job.archived ? "Restore" : "Archive"}</button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderReportPreview() {
  const period = exportPeriod.value;
  const dateKey = exportDate.value || localDateKey();
  const jobId = exportJob.value || "all";

  exportDateWrap.classList.toggle("hidden", period === "all");

  const reportShifts = getFilteredShifts({ period, dateKey, jobId });
  const summary = getSummary(reportShifts);
  const range = getPeriodRange(period, dateKey);
  const job = jobId === "all" ? null : getJob(jobId);

  $("reportPreviewPeriod").textContent = job
    ? `${range.label} · ${job.name}`
    : range.label;
  $("reportPreviewShifts").textContent = summary.count;
  $("reportPreviewHours").textContent = formatDuration(summary.totalMinutes);
  $("reportPreviewEarnings").textContent = formatMoney(summary.earnings);
}

function navigate(viewName) {
  const validViews = ["dashboard", "shifts", "reports", "settings"];
  const view = validViews.includes(viewName) ? viewName : "dashboard";

  $$(".app-view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });

  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === view);
  });

  if (location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (view === "dashboard") renderDashboard();
  if (view === "shifts") renderShiftList();
  if (view === "reports") renderReportPreview();
  if (view === "settings") {
    renderSettings();
    renderJobs();
  }
}

function navigateFromHash() {
  const requested = location.hash.replace("#", "");
  navigate(requested || "dashboard");
}

function showToast(message, duration = 2600) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), duration);
}

function updateConnectionStatus() {
  const badge = $("onlineBadge");
  const isOnline = navigator.onLine;
  badge.textContent = isOnline ? "Online" : "Offline";
  badge.classList.toggle("offline", !isOnline);
}

function resetShiftForm() {
  form.reset();
  editIdInput.value = "";
  dateInput.value = localDateKey();
  breakInput.value = "0";
  jobInput.value = settings.defaultJobId;
  saveBtn.textContent = "Add shift";
  $("shiftFormTitle").textContent = "Add a shift";
  cancelEditBtn.classList.add("hidden");
  formMessage.textContent = "";
}

function editShift(shift) {
  editIdInput.value = shift.id;
  dateInput.value = shift.date;
  jobInput.value = shift.jobId;
  timeInInput.value = shift.timeIn;
  timeOutInput.value = shift.timeOut;
  breakInput.value = String(shift.breakMinutes || 0);
  noteInput.value = shift.note || "";
  saveBtn.textContent = "Update shift";
  $("shiftFormTitle").textContent = "Edit shift";
  cancelEditBtn.classList.remove("hidden");
  navigate("shifts");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function duplicateShift(shift) {
  const copy = {
    ...shift,
    id: makeId(),
    date: localDateKey(),
    createdAt: new Date().toISOString(),
    source: "duplicate",
  };
  shifts.push(copy);
  saveShifts();
  renderAll();
  showToast("Shift duplicated with today's date.");
}

function getReportModel() {
  const period = exportPeriod.value;
  const dateKey = exportDate.value || localDateKey();
  const jobId = exportJob.value || "all";
  const range = getPeriodRange(period, dateKey);
  const reportShifts = getFilteredShifts({ period, dateKey, jobId }).sort(
    compareShiftsAscending,
  );

  return {
    period,
    dateKey,
    range,
    jobId,
    jobLabel: jobId === "all" ? "All jobs" : getJob(jobId)?.name || "Job",
    shifts: reportShifts,
    summary: getSummary(reportShifts),
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function createCsvReport(model) {
  const rows = [
    [
      "Day",
      "Date",
      "Job",
      "Time In",
      "Time Out",
      "Break (min)",
      "Paid Hours",
      "Estimated Earnings",
      "Note",
    ],
  ];

  model.shifts.forEach((shift) => {
    rows.push([
      new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(
        dateFromKey(shift.date),
      ),
      shortDateLabel(shift.date),
      getJob(shift.jobId)?.name || "Unassigned",
      shift.timeIn,
      shift.timeOut,
      shift.breakMinutes || 0,
      (shift.minutes / 60).toFixed(2),
      getShiftEarnings(shift).toFixed(2),
      shift.note || "",
    ]);
  });

  rows.push([]);
  rows.push([
    "TOTAL",
    model.range.label,
    model.jobLabel,
    "",
    "",
    "",
    (model.summary.totalMinutes / 60).toFixed(2),
    model.summary.earnings.toFixed(2),
    `${model.summary.count} shift(s)`,
  ]);

  const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const filename = reportFilename(model, "csv");
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
}

function reportFilename(model, extension) {
  const jobPart =
    model.jobId === "all" ? "all-jobs" : sanitizeFilePart(model.jobLabel);
  return `shiftlog-${model.range.fileLabel}-${jobPart}.${extension}`;
}

function reportRowsHtml(model) {
  return model.shifts
    .map((shift) => {
      const day = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(
        dateFromKey(shift.date),
      );

      return `
        <tr>
          <td>${escapeHtml(day)}</td>
          <td>${escapeHtml(shortDateLabel(shift.date))}</td>
          <td>${escapeHtml(getJob(shift.jobId)?.name || "Unassigned")}</td>
          <td>${escapeHtml(shift.timeIn)}</td>
          <td>${escapeHtml(shift.timeOut)}</td>
          <td>${escapeHtml(String(shift.breakMinutes || 0))}</td>
          <td>${escapeHtml(formatDuration(shift.minutes))}</td>
          <td>${escapeHtml(formatMoney(getShiftEarnings(shift)))}</td>
        </tr>
      `;
    })
    .join("");
}

function buildReportHtml(model) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ShiftLog Report</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; color: #15231c; font-family: Arial, Helvetica, sans-serif; background: #fff; }
  .sheet { max-width: 1050px; margin: 0 auto; border: 1px solid #dfe7e2; }
  .header { display: flex; justify-content: space-between; gap: 18px; padding: 26px 30px; color: #fff; background: #102a43; }
  .header h1 { margin: 0 0 5px; font-size: 28px; letter-spacing: .08em; text-transform: uppercase; }
  .header p { margin: 0; color: #d8e6f1; }
  .period { text-align: right; }
  .meta { display: flex; justify-content: space-between; gap: 14px; padding: 18px 30px; border-bottom: 1px solid #dfe7e2; }
  .meta strong { color: #0f5132; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { color: #fff; background: #1f7a4c; }
  th, td { padding: 11px 10px; border-bottom: 1px solid #e5ece8; text-align: left; }
  tbody tr:nth-child(even) { background: #f5f7f6; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 18px 30px; background: #102a43; color: #fff; }
  .summary span { display: block; margin-bottom: 5px; color: #bfd5c8; font-size: 11px; text-transform: uppercase; }
  .summary strong { font-size: 22px; }
  .footer { padding: 12px 30px; color: #6a756f; font-size: 10px; }
  @media print { body { padding: 0; } .sheet { border: 0; } }
</style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div>
        <h1>ShiftLog Timesheet</h1>
        <p>Employee work hours log</p>
      </div>
      <div class="period">
        <strong>${escapeHtml(model.range.label)}</strong>
        <p>${escapeHtml(model.jobLabel)}</p>
      </div>
    </header>

    <section class="meta">
      <div><strong>REPORT:</strong> ${escapeHtml(model.range.label)}</div>
      <div><strong>JOB:</strong> ${escapeHtml(model.jobLabel)}</div>
    </section>

    <table>
      <thead>
        <tr>
          <th>DAY</th>
          <th>DATE</th>
          <th>JOB</th>
          <th>TIME IN</th>
          <th>TIME OUT</th>
          <th>BREAK</th>
          <th>HOURS</th>
          <th>EST. PAY</th>
        </tr>
      </thead>
      <tbody>
        ${reportRowsHtml(model)}
      </tbody>
    </table>

    <section class="summary">
      <div><span>Shifts</span><strong>${model.summary.count}</strong></div>
      <div><span>Total hours</span><strong>${escapeHtml(formatDuration(model.summary.totalMinutes))}</strong></div>
      <div><span>Est. earnings</span><strong>${escapeHtml(formatMoney(model.summary.earnings))}</strong></div>
    </section>

    <footer class="footer">
      Generated by ShiftLog · ${escapeHtml(new Date().toLocaleString("en-GB"))}
    </footer>
  </main>
</body>
</html>`;
}

function createWordReport(model) {
  const html = buildReportHtml(model);
  downloadBlob(
    html,
    "application/msword;charset=utf-8",
    reportFilename(model, "doc"),
  );
}

function createPdfReport(model) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("Pop-up blocked. Allow pop-ups, then try PDF again.", 4200);
    return;
  }

  let printStarted = false;
  const startPrint = () => {
    if (printStarted || reportWindow.closed) return;
    printStarted = true;
    reportWindow.focus();
    reportWindow.print();
  };

  reportWindow.onload = startPrint;
  reportWindow.document.open();
  reportWindow.document.write(buildReportHtml(model));
  reportWindow.document.close();

  // Fallback for browsers that do not fire load reliably for document.write().
  window.setTimeout(startPrint, 500);
}

function downloadBlob(content, mimeType, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBackup() {
  const backup = {
    app: "ShiftLog",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    jobs,
    shifts,
  };

  downloadBlob(
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8",
    `shiftlog-backup-${localDateKey()}.json`,
  );
  showToast("Backup downloaded.");
}

async function restoreBackup(file) {
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (data?.app !== "ShiftLog" || !Array.isArray(data.shifts)) {
      throw new Error("This file is not a valid ShiftLog backup.");
    }

    if (
      !confirm(
        `Restore ${data.shifts.length} shift(s)? This will replace the completed shifts, jobs and settings stored in this copy of ShiftLog.`,
      )
    ) {
      return;
    }

    if (Array.isArray(data.jobs) && data.jobs.length) {
      jobs = data.jobs.map((job) => ({
        id: String(job.id || makeId()),
        name: String(job.name || "Untitled job"),
        rate: Math.max(0, Number(job.rate) || 0),
        archived: Boolean(job.archived),
      }));
    } else {
      jobs = [{ ...DEFAULT_JOB }];
    }

    settings = {
      ...DEFAULT_SETTINGS,
      ...(data.settings || {}),
    };
    ensureSettingsAreValid();

    shifts = data.shifts
      .filter((shift) => shift?.date && shift?.timeIn && shift?.timeOut)
      .map((shift) => ({
        ...shift,
        id: String(shift.id || makeId()),
        jobId: String(shift.jobId || settings.defaultJobId),
        grossMinutes: Math.max(
          0,
          Number(shift.grossMinutes ?? shift.minutes) || 0,
        ),
        breakMinutes: Math.max(0, Number(shift.breakMinutes) || 0),
        minutes: Math.max(0, Number(shift.minutes) || 0),
        hourlyRate:
          shift.hourlyRate === null || shift.hourlyRate === undefined
            ? null
            : Math.max(0, Number(shift.hourlyRate) || 0),
        note: String(shift.note || ""),
      }));

    saveJobs();
    saveSettings();
    saveShifts();
    renderAll();
    navigate("dashboard");
    showToast("Backup restored successfully.");
  } catch (error) {
    alert(error.message || "Could not restore this backup.");
  } finally {
    $("restoreInput").value = "";
  }
}

function resetJobForm() {
  jobForm.reset();
  jobEditId.value = "";
  saveJobBtn.textContent = "Add job";
  cancelJobEditBtn.classList.add("hidden");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const date = dateInput.value;
  const jobId = jobInput.value;
  const timeIn = timeInInput.value;
  const timeOut = timeOutInput.value;
  const breakMinutes = Math.max(0, Number(breakInput.value) || 0);

  if (!date || !jobId || !timeIn || !timeOut) {
    formMessage.textContent = "Please complete the required fields.";
    return;
  }

  const grossMinutes = minutesBetween(timeIn, timeOut);

  if (grossMinutes <= 0 || grossMinutes > 24 * 60) {
    formMessage.textContent = "Please check your time-in and time-out.";
    return;
  }

  if (breakMinutes >= grossMinutes) {
    formMessage.textContent = "The break must be shorter than the shift.";
    return;
  }

  const paidMinutes = grossMinutes - breakMinutes;
  const job = getJob(jobId);
  const editingId = editIdInput.value;

  if (editingId) {
    const index = shifts.findIndex((shift) => shift.id === editingId);
    if (index === -1) return;

    shifts[index] = {
      ...shifts[index],
      date,
      jobId,
      timeIn,
      timeOut,
      grossMinutes,
      breakMinutes,
      minutes: paidMinutes,
      hourlyRate: Number(job?.rate) || 0,
      note: noteInput.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    showToast("Shift updated.");
  } else {
    shifts.push({
      id: makeId(),
      date,
      jobId,
      timeIn,
      timeOut,
      grossMinutes,
      breakMinutes,
      minutes: paidMinutes,
      hourlyRate: Number(job?.rate) || 0,
      note: noteInput.value.trim(),
      source: "manual",
      createdAt: new Date().toISOString(),
    });

    showToast("Shift added.");
  }

  saveShifts();
  resetShiftForm();
  renderAll();
});

$("shiftList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const shift = shifts.find((item) => item.id === button.dataset.id);
  if (!shift) return;

  if (button.dataset.action === "edit") {
    editShift(shift);
    return;
  }

  if (button.dataset.action === "duplicate") {
    duplicateShift(shift);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete the shift on ${dateLabel(shift.date)}?`)) return;
    shifts = shifts.filter((item) => item.id !== shift.id);
    saveShifts();
    renderAll();
    showToast("Shift deleted.");
  }
});

cancelEditBtn.addEventListener("click", resetShiftForm);

clockButton.addEventListener("click", () => {
  if (clockActionLocked) return;

  clockActionLocked = true;
  clockButton.disabled = true;

  try {
    if (!activeSession) {
      const selectedJobId = clockJob.value || settings.defaultJobId;
      activeSession = {
        startedAt: new Date().toISOString(),
        jobId: selectedJobId,
      };

      saveActiveSession();
      renderClockState();
      showToast("Clocked in.");
      return;
    }

    const end = new Date();
    const start = new Date(activeSession.startedAt);
    const millisecondsWorked = Math.max(0, end.getTime() - start.getTime());
    const grossMinutes = Math.floor(millisecondsWorked / 60000);
    const job = getJob(activeSession.jobId);

    shifts.push({
      id: makeId(),
      date: localDateKey(start),
      jobId: activeSession.jobId,
      timeIn: localTimeKey(start),
      timeOut: localTimeKey(end),
      grossMinutes,
      breakMinutes: 0,
      minutes: grossMinutes,
      hourlyRate: Number(job?.rate) || 0,
      note: "Clocked shift",
      source: "quick-clock",
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      createdAt: end.toISOString(),
    });

    saveShifts();
    activeSession = null;
    clearActiveSession();
    renderClockState();
    renderAll();
    showToast(`Shift saved: ${formatDuration(grossMinutes)}.`);
  } finally {
    clockActionLocked = false;
    clockButton.disabled = false;
  }
});

[dashboardPeriod, dashboardDate, dashboardJob].forEach((control) => {
  control.addEventListener("change", renderDashboard);
});

["historySearch", "historyJob", "historyMonth"].forEach((id) => {
  $(id).addEventListener(id === "historySearch" ? "input" : "change", renderShiftList);
});

$("clearHistoryFilters").addEventListener("click", () => {
  $("historySearch").value = "";
  $("historyJob").value = "all";
  $("historyMonth").value = "";
  renderShiftList();
});

[exportPeriod, exportDate, exportJob].forEach((control) => {
  control.addEventListener("change", renderReportPreview);
});

$("quickExportBtn").addEventListener("click", () => navigate("reports"));

createExportBtn.addEventListener("click", () => {
  const model = getReportModel();

  if (!model.shifts.length) {
    showToast("There are no shifts in this report period.");
    return;
  }

  if (exportFormat.value === "csv") {
    createCsvReport(model);
    showToast("CSV report created.");
    return;
  }

  if (exportFormat.value === "doc") {
    createWordReport(model);
    showToast("Word report created.");
    return;
  }

  createPdfReport(model);
});

$("backupBtn").addEventListener("click", downloadBackup);
$("restoreInput").addEventListener("change", (event) =>
  restoreBackup(event.target.files?.[0]),
);

$("saveSettingsBtn").addEventListener("click", () => {
  settings.currency = currencySelect.value;
  settings.defaultJobId = defaultJobSelect.value;
  saveSettings();
  renderAll();
  renderClockState();
  showToast("Settings saved.");
});

jobForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = jobNameInput.value.trim();
  const rate = Math.max(0, Number(jobRateInput.value) || 0);
  const editingId = jobEditId.value;

  if (!name) return;

  if (editingId) {
    const job = getJob(editingId);
    if (!job) return;
    job.name = name;
    job.rate = rate;
    showToast("Job updated.");
  } else {
    const newJob = {
      id: makeId(),
      name,
      rate,
      archived: false,
    };
    jobs.push(newJob);

    if (activeJobs().length === 1) {
      settings.defaultJobId = newJob.id;
    }
    showToast("Job added.");
  }

  saveJobs();
  saveSettings();
  resetJobForm();
  renderAll();
  renderClockState();
});

$("jobList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-job-action]");
  if (!button) return;

  const job = getJob(button.dataset.id);
  if (!job) return;

  if (button.dataset.jobAction === "edit") {
    jobEditId.value = job.id;
    jobNameInput.value = job.name;
    jobRateInput.value = String(job.rate);
    saveJobBtn.textContent = "Update job";
    cancelJobEditBtn.classList.remove("hidden");
    jobForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (button.dataset.jobAction === "archive") {
    if (!job.archived) {
      if (activeJobs().length <= 1) {
        showToast("Keep at least one active job.");
        return;
      }

      if (activeSession?.jobId === job.id) {
        showToast("Clock out before archiving this job.");
        return;
      }

      job.archived = true;

      if (settings.defaultJobId === job.id) {
        settings.defaultJobId =
          activeJobs().find((item) => item.id !== job.id)?.id ||
          activeJobs()[0]?.id;
      }

      showToast("Job archived.");
    } else {
      job.archived = false;
      showToast("Job restored.");
    }

    saveJobs();
    saveSettings();
    renderAll();
    renderClockState();
  }
});

cancelJobEditBtn.addEventListener("click", resetJobForm);

$("resetAllBtn").addEventListener("click", () => {
  if (
    !confirm(
      "Delete all ShiftLog data stored in this browser/app copy? Download a backup first if you may need the data later.",
    )
  ) {
    return;
  }

  [
    STORAGE_KEY,
    ACTIVE_SHIFT_KEY,
    ACTIVE_SESSION_KEY,
    SETTINGS_KEY,
    JOBS_KEY,
  ].forEach((key) => localStorage.removeItem(key));

  jobs = [{ ...DEFAULT_JOB }];
  settings = { ...DEFAULT_SETTINGS };
  shifts = [];
  activeSession = null;

  saveJobs();
  saveSettings();
  saveShifts();
  resetShiftForm();
  resetJobForm();
  renderClockState();
  renderAll();
  navigate("dashboard");
  showToast("Local ShiftLog data deleted.");
});

$$("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.viewTarget));
});

window.addEventListener("hashchange", navigateFromHash);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("installBtn").classList.remove("hidden");
});

$("installBtn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installBtn").classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  $("installBtn").classList.add("hidden");
  showToast("ShiftLog installed.");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeSession) updateLiveTimer();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((error) => console.warn("Service worker registration failed:", error));
  });
}
