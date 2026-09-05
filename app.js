const STORAGE_KEY = "shiftlog_shifts_v1";
const ACTIVE_SHIFT_KEY = "shiftlog_active_shift_v1";

const $ = (id) => document.getElementById(id);

const clockButton = document.getElementById("clockButton");
const clockStatus = document.getElementById("clockStatus");
const liveTimer = document.getElementById("liveTimer");

const form = $("shiftForm");
const dateInput = $("date");
const timeInInput = $("timeIn");
const timeOutInput = $("timeOut");
const noteInput = $("note");
const editIdInput = $("editId");
const saveBtn = $("saveBtn");
const cancelEditBtn = $("cancelEditBtn");
const formMessage = $("formMessage");
const exportPanel = $("exportPanel");
const exportPeriod = $("exportPeriod");
const exportDate = $("exportDate");
const exportFormat = $("exportFormat");
const createExportBtn = $("createExportBtn");

let activeShift = loadActiveShift();

let shifts = loadShifts();

let clockTimerInterval = null;

dateInput.value = new Date().toISOString().slice(0, 10);

exportDate.value = localDateKey();

render();
renderClockState();

// clockButton.addEventListener("click", () => {
//   activeShift = new Date();

//   clockStatus.textContent = `clocked in at ${activeShift.toLocaleTimeString()}`;
//   clockButton.textContent = "CLOCK OUT";
// });

clockButton.addEventListener("click", () => {
  if (activeShift === null) {
    activeShift = new Date();

    saveActiveShift();

    renderClockState();

    clockStatus.textContent = `Clocked in at ${activeShift.toLocaleTimeString()}`;

    clockButton.textContent = "CLOCK OUT";
    clockButton.classList.add("clock-out");
  } else {
    const clockOutTime = new Date();

    const millisecondsWorked = clockOutTime - activeShift;

    const minutesWorked = Math.floor(millisecondsWorked / 1000 / 60);

    const completedShift = {
      id: crypto.randomUUID(),
      date: localDateKey(activeShift),
      timeIn: activeShift.toTimeString().slice(0, 5),
      timeOut: clockOutTime.toTimeString().slice(0, 5),
      minutes: minutesWorked,
      note: "Clocked shift",
    };
    shifts.push(completedShift);

    saveShifts();

    activeShift = null;

    clearActiveShift();

    render();

    renderClockState();

    clockStatus.textContent = `Shift complete: ${formatDuration(minutesWorked)}`;

    clockButton.textContent = "CLOCK IN";
    clockButton.classList.remove("clock-out");
  }
});
// FORMAT ELAPSED TIME
function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
// TIMER UPDATE
function updateLiveTimer() {
  if (!activeShift) {
    return;
  }

  const currentTime = new Date();

  const millisecondsWorked = currentTime - activeShift;

  liveTimer.textContent = formatElapsedTime(millisecondsWorked);
}

// TIMER START
function startLiveTimer() {
  stopLiveTimer();

  updateLiveTimer();

  clockTimerInterval = setInterval(updateLiveTimer, 1000);
}

// STOP THE TIMER
function stopLiveTimer() {
  if (clockTimerInterval !== null) {
    clearInterval(clockTimerInterval);

    clockTimerInterval = null;
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadShifts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];

    return saved.map((shift) => ({
      ...shift,
      id: String(shift.id ?? crypto.randomUUID()),
    }));
  } catch {
    return [];
  }
}

function loadActiveShift() {
  const savedTime = localStorage.getItem(ACTIVE_SHIFT_KEY);

  if (!savedTime) {
    return null;
  }

  const savedDate = new Date(savedTime);

  if (Number.isNaN(savedDate.getTime())) {
    return null;
  }

  return savedDate;
}

function saveActiveShift() {
  localStorage.setItem(ACTIVE_SHIFT_KEY, activeShift.toISOString());
}

function clearActiveShift() {
  localStorage.removeItem(ACTIVE_SHIFT_KEY);
}

function saveShifts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
}

// function renderClockState() {
//   if (activeShift) {
//     clockStatus.textContent = `Clocked in at ${activeShift.toLocaleTimeString()}`;
//     clockButton.textContent = "CLOCK OUT";
//   } else {
//     clockStatus.textContent = "You're currently clocked out";

//     clockButton.textContent = "CLOCK IN";
//   }
// }

// UPGRADE
function renderClockState() {
  if (activeShift) {
    clockStatus.textContent = `Clocked in at ${activeShift.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    )}`;

    clockButton.textContent = "CLOCK OUT";

    liveTimer.classList.remove("hidden");

    startLiveTimer();
  } else {
    clockStatus.textContent = "You're currently clocked out";

    clockButton.textContent = "CLOCK IN";

    liveTimer.classList.add("hidden");

    stopLiveTimer();
  }
}

function minutesBetween(timeIn, timeOut) {
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  let start = ih * 60 + im;
  let end = oh * 60 + om;
  if (end < start) end += 24 * 60; // overnight shift, e.g. 5pm–2am
  return end - start;
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function dateLabel(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function currentMonthKey() {
  return localDateKey().slice(0, 7);
}

function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function render() {
  const month = currentMonthKey();
  const monthShifts = shifts.filter((s) => s.date.startsWith(month));
  const monthMinutes = monthShifts.reduce((sum, s) => sum + s.minutes, 0);
  const totalMinutes = shifts.reduce((sum, s) => sum + s.minutes, 0);
  const weekStartDate = weekStart();
  const weekMinutes = shifts
    .filter((s) => new Date(`${s.date}T12:00:00`) >= weekStartDate)
    .reduce((sum, s) => sum + s.minutes, 0);
  const avg = monthShifts.length
    ? Math.round(monthMinutes / monthShifts.length)
    : 0;

  $("monthHours").textContent = formatDuration(monthMinutes);
  $("totalHours").textContent = formatDuration(totalMinutes);
  $("shiftCount").textContent = monthShifts.length;
  $("avgHours").textContent = formatDuration(avg);
  $("weekHours").textContent = formatDuration(weekMinutes);
  $("monthLabel").textContent = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const list = $("shiftList");
  const sorted = [...shifts].sort((a, b) =>
    `${b.date}${b.timeIn}`.localeCompare(`${a.date}${a.timeIn}`),
  );
  if (!sorted.length) {
    list.innerHTML =
      '<div class="empty">No shifts yet. Add your first shift above.</div>';
    return;
  }

  list.innerHTML = sorted
    .map(
      (s) => `
    <article class="shift-card">
      <div>
        <div class="shift-date">${escapeHtml(dateLabel(s.date))}</div>
        <div class="shift-time">${s.timeIn} – ${s.timeOut}${s.timeOut < s.timeIn ? " · overnight" : ""}</div>
        ${s.note ? `<div class="shift-note">${escapeHtml(s.note)}</div>` : ""}
      </div>
      <div class="shift-duration">${formatDuration(s.minutes)}</div>
      <div class="card-actions">
        <button class="small-btn" data-action="edit" data-id="${s.id}">Edit</button>
        <button class="small-btn delete" data-action="delete" data-id="${s.id}">Delete</button>
      </div>
    </article>
  `,
    )
    .join("");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  const date = dateInput.value;
  const timeIn = timeInInput.value;
  const timeOut = timeOutInput.value;
  if (!date || !timeIn || !timeOut) return;

  const minutes = minutesBetween(timeIn, timeOut);
  if (minutes <= 0 || minutes > 24 * 60) {
    formMessage.textContent = "Please check your time-in and time-out.";
    return;
  }

  const editingId = editIdInput.value;
  if (editingId) {
    const index = shifts.findIndex((s) => String(s.id) === editingId);
    if (index !== -1)
      shifts[index] = {
        ...shifts[index],
        date,
        timeIn,
        timeOut,
        minutes,
        note: noteInput.value.trim(),
      };
  } else {
    shifts.push({
      id: crypto.randomUUID(),
      date,
      timeIn,
      timeOut,
      minutes,
      note: noteInput.value.trim(),
    });
  }
  saveShifts();
  resetForm();
  render();
});

$("shiftList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const shift = shifts.find((s) => String(s.id) === button.dataset.id);
  if (!shift) return;

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete the shift on ${dateLabel(shift.date)}?`)) return;
    shifts = shifts.filter((s) => String(s.id) !== String(shift.id));
    saveShifts();
    render();
  }

  if (button.dataset.action === "edit") {
    editIdInput.value = String(shift.id);
    dateInput.value = shift.date;
    timeInInput.value = shift.timeIn;
    timeOutInput.value = shift.timeOut;
    noteInput.value = shift.note || "";
    saveBtn.textContent = "Update shift";
    cancelEditBtn.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

cancelEditBtn.addEventListener("click", resetForm);

// OLD BTN BEHAVIOR

// $("exportBtn").addEventListener("click", () => {
//   if (!shifts.length) return alert("There are no shifts to export yet.");
//   const rows = [["Date", "Time In", "Time Out", "Hours", "Minutes", "Note"]];
//   [...shifts]
//     .sort((a, b) =>
//       `${a.date}${a.timeIn}`.localeCompare(`${b.date}${b.timeIn}`),
//     )
//     .forEach((s) => {
//       rows.push([
//         s.date,
//         s.timeIn,
//         s.timeOut,
//         (s.minutes / 60).toFixed(2),
//         s.minutes,
//         s.note || "",
//       ]);
//     });
//   const totalMinutes = shifts.reduce((sum, s) => sum + s.minutes, 0);
//   rows.push([]);
//   rows.push([
//     "TOTAL",
//     "",
//     "",
//     (totalMinutes / 60).toFixed(2),
//     totalMinutes,
//     "All recorded shifts",
//   ]);
//   const csv = rows
//     .map((row) =>
//       row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
//     )
//     .join("\n");
//   const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = `shiftlog-${currentMonthKey()}.csv`;
//   a.click();
//   URL.revokeObjectURL(url);
// });

// NEW BTN BEHAVIOR

$("exportBtn").addEventListener("click", () => {
  exportPanel.classList.toggle("hidden");
});

function resetForm() {
  form.reset();
  editIdInput.value = "";
  dateInput.value = localDateKey();
  saveBtn.textContent = "Add shift";
  cancelEditBtn.classList.add("hidden");
  formMessage.textContent = "";
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
