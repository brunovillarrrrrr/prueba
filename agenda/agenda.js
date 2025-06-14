/* ────────────────────────────────────────────────────────────
   agenda.js
   · SQLite (sql.js) en navegador  + persistencia localStorage
   · Tema claro / oscuro  + sidebar colapsable
   · Vista MES  +  Vista DÍA (timeline)
   · CRUD de eventos  +  drag&drop para mover hora/día  +  toast + notificación push
───────────────────────────────────────────────────────────── */

let db;
const DB_KEY = "alsAgendaSqlDb";

/* ===== Base64 helpers ===== */
const u8ToB64 = (u8) => btoa(String.fromCharCode(...u8));
const b64ToU8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/* ===== Carga sql.js y abre / crea DB ===== */
const DB_INIT = initSqlJs({
  locateFile: (f) =>
    "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/sql-wasm.wasm",
}).then((SQL) => {
  const saved = localStorage.getItem(DB_KEY);
  db = saved ? new SQL.Database(b64ToU8(saved)) : new SQL.Database();

  db.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT,
      start_time TEXT,
      end_time TEXT,
      category TEXT,
      description TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    INSERT OR IGNORE INTO users(id,email,password_hash)
    VALUES(1,'demo@user.com','demo');
  `);

  if (!saved) persistDb();
});

/* ===== Persistencia ===== */
function persistDb() {
  localStorage.setItem(DB_KEY, u8ToB64(db.export()));
}

/* ===== Notificaciones push (API Notification) ===== */
function pedirPermisoNoti() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "default") Notification.requestPermission();
  return Notification.permission === "granted";
}
function lanzarNoti(titulo, cuerpo) {
  if (pedirPermisoNoti()) {
    new Notification(titulo, { body: cuerpo, icon: "/favicon.ico" });
  } else {
    alert(cuerpo); // respaldo
  }
}

/* ===== Helpers DOM ===== */
const $ = (s) => document.querySelector(s);

/* ===== Tema claro / oscuro (iconos) ===== */
const sunSVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

const moonSVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", dark ? "light" : "dark");
  document
    .querySelectorAll(".theme-toggle")
    .forEach((b) => (b.innerHTML = dark ? moonSVG : sunSVG));
}

/* ===== Toast ===== */
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 5000);
}

/* ===== Helpers fecha ===== */
const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/* ===== Vista MES ===== */
function buildMonthView(base = new Date()) {
  const y = base.getFullYear(),
    m = base.getMonth();
  const first = new Date(y, m, 1);
  const startIdx = (first.getDay() + 6) % 7;
  const totalDays = new Date(y, m + 1, 0).getDate();
  const todayStr = formatDate(new Date());

  $("#monthHeader").innerHTML = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    .map((d) => `<div>${d}</div>`)
    .join("");

  const grid = $("#monthGrid");
  grid.innerHTML = "";
  const cells = Math.ceil((startIdx + totalDays) / 7) * 7;

  for (let i = 0; i < cells; i++) {
    const dNum = i - startIdx + 1;
    const div = document.createElement("div");
    div.className = "day";
    if (dNum > 0 && dNum <= totalDays) {
      const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(dNum).padStart(
        2,
        "0"
      )}`;
      div.dataset.date = date;
      div.innerHTML = `<span class="day-num">${dNum}</span>`;
      if (date === todayStr) div.classList.add("today");

      const st = db.prepare(
        "SELECT COUNT(*) AS c FROM events WHERE date(start_time)=?"
      );
      st.bind([date]);
      st.step();
      if (st.getAsObject().c) div.classList.add("event");
      st.free();

      div.onclick = () => switchToDay(date);
    }
    grid.appendChild(div);
  }
}

/* ===== Vista DÍA (timeline) ===== */
function buildTimeline() {
  const wrap = $("#dayView");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    wrap.insertAdjacentHTML(
      "beforeend",
      `<div class="hour-row">
         <div class="hour-label">${String(h).padStart(2, "0")}:00</div>
         <div class="hour-slot" data-hour="${h}"></div>
       </div>`
    );
  }

  // Hacer que cada slot acepte drop
  wrap
    .querySelectorAll(".hour-slot")
    .forEach((slot) => {
      slot.ondblclick = () => openModal(+slot.dataset.hour);
      slot.ondragover = (e) => e.preventDefault();
      slot.ondrop = onDropEvent;
    });
}

function loadEvents(dateStr) {
  if (!db) return;
  buildTimeline();
  const stmt = db.prepare(
    "SELECT id,title,start_time,end_time,category FROM events WHERE date(start_time)=?"
  );
  stmt.bind([dateStr]);
  while (stmt.step()) {
    const ev = stmt.getAsObject();
    const s = new Date(ev.start_time);
    const e = new Date(ev.end_time);
    const dur = (e - s) / 3600000;
    const slot = $(`.hour-slot[data-hour="${s.getHours()}"]`);
    if (!slot) continue;

    const div = document.createElement("div");
    div.className = "event";
    div.setAttribute("draggable", "true");
    div.dataset.id = ev.id; // para referencia
    if (ev.category) div.classList.add(ev.category.toLowerCase());
    div.textContent = ev.title;
    div.dataset.tooltip = `${ev.title} (${s
      .toTimeString()
      .slice(0, 5)}-${e.toTimeString().slice(0, 5)})`;
    if (dur > 1) div.style.height = `${dur * 40 - 4}px`;

    // Cuando arranca el drag, guardo el id y la hora original
    div.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", ev.id);
      e.dataTransfer.effectAllowed = "move";
    };

    // Al hacer clic, abro el modal para editar/borrar
    div.onclick = () => openEditModal(ev.id, ev.title, ev.start_time, ev.end_time, ev.category, ev);

    slot.appendChild(div);
  }
  stmt.free();
}

/* ===== Drag&Drop: al soltar ===== */
function onDropEvent(e) {
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  const slotHour = +e.currentTarget.dataset.hour;
  const date = $("#datePicker").value; // día actual en el datepicker

  // Hago una SELECT para sacar duración
  const sel = db.prepare("SELECT start_time,end_time FROM events WHERE id = ?");
  sel.bind([id]);
  sel.step();
  const row = sel.getAsObject();
  sel.free();
  if (!row.start_time) return;

  const oldStart = new Date(row.start_time);
  const durationHours = (new Date(row.end_time) - oldStart) / 3600000;

  // Nuevo inicio = date + slotHour
  const newStart = new Date(`${date}T${String(slotHour).padStart(2, "0")}:00`);
  const newEnd = new Date(newStart.getTime() + durationHours * 3600000);

  // UPDATE en la DB
  db.run(
    `UPDATE events SET start_time = ?, end_time = ? WHERE id = ?`,
    [newStart.toISOString(), newEnd.toISOString(), id]
  );
  persistDb();

  // ⚡ animación de pulso en el punto rojo del mes (si hubiera un día nuevo)
  const dayCell = document.querySelector(`.calendar-grid .day[data-date="${date}"]`);
  if (dayCell) {
    dayCell.classList.add("pulse");
    setTimeout(() => dayCell.classList.remove("pulse"), 400);
  }

  // Recargo vistas
  buildMonthView(new Date($("#datePicker").value));
  loadEvents($("#datePicker").value);
}

/* ===== Modal CRUD ===== */
function openModal(hour) {
  $("#evtId").value = ""; // limpio para “nuevo”
  $("#evtTitle").value = "";
  $("#evtCategory").value = "Trabajo";
  $("#evtDesc").value = "";

  const dSel = $("#datePicker").value || formatDate(new Date());
  const sIn = $("#evtStart");
  const eIn = $("#evtEnd");
  if (hour !== undefined) {
    const start = new Date(`${dSel}T${String(hour).padStart(2, "0")}:00`);
    sIn.value = start.toISOString().slice(0, 16);
    eIn.value = new Date(start.getTime() + 3600000).toISOString().slice(0, 16);
  } else {
    const now = new Date();
    sIn.value = now.toISOString().slice(0, 16);
    eIn.value = new Date(now.getTime() + 3600000).toISOString().slice(0, 16);
  }

  $("#deleteBtn").style.display = "none";
  $("#modalBg").style.display = "flex";
}

function openEditModal(id, title, start, end, category, evRow) {
  $("#evtId").value = id;
  $("#evtTitle").value = title;
  $("#evtStart").value = start.slice(0, 16);
  $("#evtEnd").value = end.slice(0, 16);
  $("#evtCategory").value = category;
  $("#evtDesc").value = evRow.description || "";

  $("#deleteBtn").style.display = "inline-block";
  $("#modalBg").style.display = "flex";
}

// Cerrar modal
const closeModal = () => ($("#modalBg").style.display = "none");

// Guardar / Actualizar evento
function saveEvent(e) {
  e.preventDefault();
  const id = $("#evtId").value;
  const title = $("#evtTitle").value.trim();
  const st = $("#evtStart").value;
  const et = $("#evtEnd").value;
  const cat = $("#evtCategory").value;
  const desc = $("#evtDesc").value.trim();

  if (!title || !st || !et) {
    return alert("Completa título y fechas");
  }

  if (id) {
    // UPDATE
    db.run(
      `UPDATE events
       SET title = ?, start_time = ?, end_time = ?, category = ?, description = ?
       WHERE id = ?`,
      [title, st, et, cat, desc, id]
    );
  } else {
    // INSERT
    db.run(
      `INSERT INTO events(user_id,title,start_time,end_time,category,description)
       VALUES(1,?,?,?,?,?)`,
      [title, st, et, cat, desc]
    );
  }
  persistDb();

  closeModal();
  buildMonthView(new Date($("#datePicker").value));
  loadEvents($("#datePicker").value);
}

// Borrar evento
document.addEventListener("click", (e) => {
  if (e.target.matches("#deleteBtn")) {
    const id = $("#evtId").value;
    if (!id) return closeModal();
    if (confirm("¿Eliminar esta cita?")) {
      db.run(`DELETE FROM events WHERE id = ?`, [id]);
      persistDb();
      closeModal();
      buildMonthView(new Date($("#datePicker").value));
      loadEvents($("#datePicker").value);
    }
  }
});

/* ===== Navegación ===== */
function switchToDay(dateStr) {
  $("#monthSection").style.display = "none";
  $("#daySection").style.display = "block";
  $("#viewTitle").textContent = "Día";
  $("#datePicker").value = dateStr;
  loadEvents(dateStr);
}

function backToMonth() {
  $("#daySection").style.display = "none";
  $("#monthSection").style.display = "block";
  $("#viewTitle").textContent = "Calendario";
  buildMonthView(new Date($("#datePicker").value));
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
  /* solicitar permiso notificaciones si hace falta */
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  /* botones tema */
  document.querySelectorAll(".theme-toggle").forEach((b) => {
    b.innerHTML =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? sunSVG
        : moonSVG;
    b.onclick = toggleTheme;
  });

  /* login.html */
  if ($("#loginForm")) {
    $("#loginForm").onsubmit = (e) => {
      e.preventDefault();
      location.href = "dashboard.html";
    };
    return;
  }

  /* dashboard.html */
  const today = formatDate(new Date());
  $("#datePicker").value = today;

  $("#menu-toggle").onclick = () => {
    const sb = $("#sidebar");
    innerWidth <= 768
      ? sb.classList.toggle("open")
      : sb.classList.toggle("collapsed");
  };
  $("#backToMonth").onclick = backToMonth;
  $("#addEventBtn").onclick = () => openModal();
  $("#cancelBtn").onclick = closeModal;
  $("#eventForm").onsubmit = saveEvent;
  $("#datePicker").onchange = (e) => loadEvents(e.target.value);

  DB_INIT.then(() => {
    buildMonthView(new Date());
    buildTimeline();
    loadEvents(today);
  });
});
