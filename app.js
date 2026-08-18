const SUPABASE_URL = "https://vpfckslzjpvaurxitkpk.supabase.co";
const SUPABASE_KEY = "sb_publishable_F9HeyytRDxbbD-Q6j2_SuQ_SFKL8qOb";

let db = null;
let state = {
  active: null,
  users: {},
  session: null
};

let currentView = "today";
let calCursor = new Date();

const defaultHabits = [
  {id:"water",icon:"💧",title:"2 литра воды",meta:"Цель: 2 000 мл"},
  {id:"lemon",icon:"🍋",title:"Вода с лимоном",meta:"Утром"},
  {id:"wake",icon:"⏰",title:"Подъём в 7:00",meta:"Начать день вовремя"},
  {id:"exercise",icon:"☀️",title:"Утренняя зарядка",meta:"Ежедневно"},
  {id:"steps",icon:"👣",title:"10 000 шагов",meta:"Можно указать фактическое количество"},
  {id:"food",icon:"🍽️",title:"Записать всё съеденное",meta:"Питание за день"},
  {id:"dinner",icon:"🥛",title:"Лёгкая замена ужина",meta:"Можно изменить в настройках"},
  {id:"book",icon:"📖",title:"20 страниц книги",meta:"Можно указать фактическое число"},
  {id:"screenmeal",icon:"📵",title:"Без телефона и ТВ во время еды",meta:"Осознанное питание"},
  {id:"entertainment",icon:"🎬",title:"Развлекательный контент ≤ 1 часа",meta:"Можно указать минуты"},
  {id:"sleep",icon:"😴",title:"Сон 23:00–00:00",meta:""}
];

function waitForSupabase() {
  if (window.supabase) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    init();
  } else {
    setTimeout(waitForSupabase, 100);
  }
}

async function init() {
  const { data } = await db.auth.getSession();

  state.session = data.session;

  if (!state.session) {
    renderLogin();
    return;
  }

  await loadState();

  db.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;

    if (!session) {
      state.active = null;
      state.users = {};
      renderLogin();
      return;
    }

    await loadState();
  });

  render();
}

async function loadState() {
  const authId = state.session.user.id;

  const { data: profiles, error } = await db
    .from("profiles")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    alert("Не удалось загрузить профили: " + error.message);
    return;
  }

  state.users = {};

  for (const p of profiles || []) {
    state.users[p.name] = {
      id: p.id,
      name: p.name,
      auth_user_id: p.auth_user_id,
      startDate: p.start_date,
      days: {},
      weights: [],
      measurements: [],
      goals: {
        socials: [],
        alcohol: false,
        wishlist: false,
        vision: false
      },
      rewards: {},
      notes: {}
    };
  }

  let me = Object.values(state.users)
    .find(u => u.auth_user_id === authId);

  if (!me) {
    alert("Для этого аккаунта не найден профиль в таблице profiles.");
    return;
  }

  state.active = me.name;

  await Promise.all(
    Object.values(state.users).map(u => loadUserData(u))
  );
}

async function loadUserData(u) {

  const [
    daysRes,
    weightsRes,
    measurementsRes,
    notesRes,
    goalsRes,
    rewardsRes
  ] = await Promise.all([

    db.from("days")
      .select("*")
      .eq("user_id", u.id)
      .order("day_date"),

    db.from("weights")
      .select("*")
      .eq("user_id", u.id)
      .order("record_date"),

    db.from("measurements")
      .select("*")
      .eq("user_id", u.id)
      .order("record_date"),

    db.from("notes")
      .select("*")
      .eq("user_id", u.id)
      .order("note_date"),

    db.from("goals")
      .select("*")
      .eq("user_id", u.id)
      .maybeSingle(),

    db.from("rewards")
      .select("*")
      .eq("user_id", u.id)
  ]);

  if (daysRes.error) console.error("days:", daysRes.error);
  if (weightsRes.error) console.error("weights:", weightsRes.error);
  if (measurementsRes.error) console.error("measurements:", measurementsRes.error);
  if (notesRes.error) console.error("notes:", notesRes.error);
  if (goalsRes.error) console.error("goals:", goalsRes.error);
  if (rewardsRes.error) console.error("rewards:", rewardsRes.error);

  (daysRes.data || []).forEach(row => {
    u.days[row.day_date] = {
      checks: row.checks || {},
      steps: row.steps || "",
      pages: row.pages || "",
      minutes: row.minutes || "",
      meal: row.meal || ""
    };
  });

  u.weights = (weightsRes.data || []).map(row => ({
    id: row.id,
    date: row.record_date,
    value: Number(row.value)
  }));

  u.measurements = (measurementsRes.data || []).map(row => ({
    id: row.id,
    date: row.record_date,
    chest: row.chest,
    waist: row.waist,
    belly: row.belly,
    hips: row.hips
  }));

  (notesRes.data || []).forEach(row => {
    u.notes[row.note_date] = row.text || "";
  });

  if (goalsRes.data) {
    u.goals = {
      socials: goalsRes.data.socials || [],
      alcohol: !!goalsRes.data.alcohol,
      wishlist: !!goalsRes.data.wishlist,
      vision: !!goalsRes.data.vision
    };
  }

  (rewardsRes.data || []).forEach(row => {
    u.rewards[row.reward_key] = true;
  });
}

function user() {
  return state.users[state.active];
}

function iso(d) {
  return d.toISOString().slice(0,10);
}

function today() {
  return iso(new Date());
}

function dayNum(date) {
  const start = new Date(user().startDate + "T00:00:00");
  const d = new Date(date + "T00:00:00");
  return Math.floor((d - start) / 86400000) + 1;
}

function eligible(date) {
  return dayNum(date) >= 1;
}

function dayData(date) {
  return user().days[date] || {
    checks: {},
    steps: "",
    pages: "",
    minutes: "",
    meal: ""
  };
}

function yoga(date) {
  const n = dayNum(date);
  return n >= 1 && n % 2 === 1;
}

function habitsFor(date) {
  return [
    ...defaultHabits,
    ...(yoga(date)
      ? [{
          id:"yoga",
          icon:"🧘",
          title:"Йога 15 минут",
          meta:"Сегодня день йоги"
        }]
      : [])
  ];
}

function statsFor(date) {
  const d = dayData(date);
  const hs = habitsFor(date);
  const done = hs.filter(h => d.checks[h.id]).length;

  return {
    done,
    total: hs.length,
    pct: hs.length
      ? Math.round(done / hs.length * 100)
      : 0
  };
}

function challengeDays() {
  const start = new Date(user().startDate + "T00:00:00");
  const now = new Date(today() + "T00:00:00");

  return Math.max(
    0,
    Math.floor((now - start) / 86400000) + 1
  );
}

function currentStreak() {
  let n = 0;
  let d = new Date(today() + "T00:00:00");

  for (let i = 0; i < 10000; i++) {
    const s = iso(d);

    if (!eligible(s)) break;

    if (statsFor(s).pct === 100) {
      n++;
    } else {
      break;
    }

    d.setDate(d.getDate() - 1);
  }

  return n;
}

function bestStreak() {
  let best = 0;
  let run = 0;

  const start = new Date(user().startDate + "T00:00:00");
  const end = new Date(today() + "T00:00:00");

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    const p = statsFor(iso(d)).pct;

    if (p === 100) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return best;
}

function overall() {
  let total = 0;
  let sum = 0;
  let full = 0;

  const start = new Date(user().startDate + "T00:00:00");
  const end = new Date(today() + "T00:00:00");

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    const s = statsFor(iso(d));

    sum += s.pct;
    total++;

    if (s.pct === 100) full++;
  }

  return {
    days: total,
    avg: total ? Math.round(sum / total) : 0,
    full
  };
}

function lastWeight() {
  return user().weights.length
    ? user().weights[user().weights.length - 1].value
    : null;
}

function initialWeight() {
  return user().weights.length
    ? user().weights[0].value
    : null;
}

function lostKg() {
  const a = initialWeight();
  const b = lastWeight();

  return a != null && b != null
    ? Math.max(0, a - b)
    : 0;
}

function beautyFund() {
  return Math.floor(lostKg()) * 1000;
}

function habitRate(id) {
  const start = new Date(user().startDate + "T00:00:00");
  const end = new Date(today() + "T00:00:00");

  let total = 0;
  let done = 0;

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    const s = iso(d);

    if (habitsFor(s).some(h => h.id === id)) {
      total++;

      if (dayData(s).checks[id]) {
        done++;
      }
    }
  }

  return total
    ? Math.round(done / total * 100)
    : 0;
}

function fmtDate(s) {
  return new Date(
    s + "T00:00:00"
  ).toLocaleDateString(
    "ru-RU",
    {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }
  );
}

/* =========================
   LOGIN
========================= */

function renderLogin() {

  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    ">
      <div class="card" style="
        width:100%;
        max-width:420px;
      ">

        <div style="
          text-align:center;
          font-size:52px;
          margin-bottom:10px;
        ">🌸</div>

        <h1 style="text-align:center">
          Новая Я
        </h1>

        <p class="muted" style="text-align:center">
          365 дней изменений
        </p>

        <div class="field">
          <label>Email</label>
          <input
            id="loginEmail"
            class="input"
            type="email"
            placeholder="Введите email"
            autocomplete="email"
          >
        </div>

        <div class="field" style="margin-top:12px">
          <label>Пароль</label>
          <input
            id="loginPassword"
            class="input"
            type="password"
            placeholder="Введите пароль"
            autocomplete="current-password"
          >
        </div>

        <button
          class="btn"
          style="width:100%;margin-top:15px"
          onclick="login()"
        >
          Войти
        </button>

        <p
          id="loginError"
          style="
            color:#c0392b;
            margin-top:12px;
            text-align:center;
          "
        ></p>

      </div>
    </div>
  `;
}

async function login() {

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  const error =
    document.getElementById("loginError");

  error.textContent = "";

  if (!email || !password) {
    error.textContent =
      "Введите email и пароль.";
    return;
  }

  const { data, error: authError } =
    await db.auth.signInWithPassword({
      email,
      password
    });

  if (authError) {
    error.textContent =
      authError.message;
    return;
  }

  state.session = data.session;

  await loadState();

  render();
}

async function logout() {
  await db.auth.signOut();
}

/* =========================
   RENDER
========================= */

function render() {

  if (!state.session || !state.active) {
    renderLogin();
    return;
  }

  const profileBtn =
    document.getElementById("profileBtn");

  if (profileBtn) {
    profileBtn.textContent =
      `${state.active} ▾`;
  }

  document
    .querySelectorAll(".view")
    .forEach(v =>
      v.classList.remove("active")
    );

  const activeView =
    document.getElementById(
      "view-" + currentView
    );

  if (activeView) {
    activeView.classList.add("active");
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(b =>
      b.classList.toggle(
        "active",
        b.dataset.view === currentView
      )
    );

  ({
    today: renderToday,
    calendar: renderCalendar,
    progress: renderProgress,
    rewards: renderRewards,
    us: renderUs
  }[currentView] || renderToday)();
}

/* =========================
   TODAY
========================= */

function renderToday() {

  const s = statsFor(today());
  const u = user();
  const n = dayNum(today());

  document.getElementById(
    "view-today"
  ).innerHTML = `

    <div class="hero">

      <div class="hero-row">

        <div>

          <div class="muted">
            ${new Date().toLocaleDateString(
              "ru-RU",
              {
                weekday:"long",
                day:"numeric",
                month:"long"
              }
            )}
          </div>

          <div class="big-day">
            ${n > 0
              ? "День " + n
              : "До старта"}
          </div>

          <div class="muted">
            Старт: ${fmtDate(u.startDate)}
          </div>

        </div>

        <div style="text-align:right">

          <div class="kpi">
            ${s.pct}%
          </div>

          <div class="muted">
            ${s.done}/${s.total} задач
          </div>

        </div>

      </div>

      <div
        class="progress-track"
        style="margin-top:18px"
      >
        <div
          class="progress-fill"
          style="width:${s.pct}%"
        ></div>
      </div>

      <div class="stats">

        <div class="stat">
          🔥 Серия
          <strong>${currentStreak()}</strong>
        </div>

        <div class="stat">
          📆 Дней
          <strong>${challengeDays()}</strong>
        </div>

        <div class="stat">
          🏆 Лучшая
          <strong>${bestStreak()}</strong>
        </div>

      </div>

    </div>

    <div class="card">

      <div class="row">
        <h2>Сегодня</h2>

        <span class="tag">
          ${
            yoga(today())
              ? "🧘 День йоги"
              : "🌿 Обычный день"
          }
        </span>
      </div>

      ${
        n < 1
          ? `
            <p class="muted">
              Дата старта ещё не наступила.
            </p>
          `
          : habitsFor(today())
              .map(h =>
                habitHtml(h, today())
              )
              .join("")
      }

    </div>

    <div class="grid">

      <div class="card">

        <h2>🍽️ Питание</h2>

        <textarea
          id="meal"
          placeholder="Что сегодня ела?"
        >${dayData(today()).meal || ""}</textarea>

        <button
          class="btn"
          style="margin-top:9px"
          onclick="saveMeal()"
        >
          Сохранить питание
        </button>

      </div>

      <div class="card">

        <h2>📝 Заметка</h2>

        <textarea
          id="note"
          placeholder="Как прошёл день?"
        >${u.notes[today()] || ""}</textarea>

        <button
          class="btn"
          style="margin-top:9px"
          onclick="saveNote()"
        >
          Сохранить заметку
        </button>

      </div>

      <div class="card">

        <h2>⚙️ Настройки</h2>

        <div class="field">

          <label>
            Дата начала
          </label>

          <input
            class="input"
            id="startDate"
            type="date"
            value="${u.startDate}"
          >

        </div>

        <button
          class="btn secondary"
          onclick="changeStart()"
        >
          Изменить дату старта
        </button>

      </div>

    </div>
  `;
}

function habitHtml(h, date) {

  const d = dayData(date);
  const checked = !!d.checks[h.id];

  let extra = "";

  if (h.id === "steps") {
    extra = `
      <input
        class="input"
        style="width:120px"
        type="number"
        placeholder="шаги"
        value="${d.steps || ""}"
        onchange="
          setExtra(
            '${date}',
            'steps',
            this.value
          )
        "
      >
    `;
  }

  if (h.id === "book") {
    extra = `
      <input
        class="input"
        style="width:110px"
        type="number"
        placeholder="страниц"
        value="${d.pages || ""}"
        onchange="
          setExtra(
            '${date}',
            'pages',
            this.value
          )
        "
      >
    `;
  }

  if (h.id === "entertainment") {
    extra = `
      <input
        class="input"
        style="width:110px"
        type="number"
        placeholder="минут"
        value="${d.minutes || ""}"
        onchange="
          setExtra(
            '${date}',
            'minutes',
            this.value
          )
        "
      >
    `;
  }

  return `
    <div class="habit">

      <input
        type="checkbox"
        ${checked ? "checked" : ""}
        onchange="
          toggleHabit(
            '${date}',
            '${h.id}',
            this.checked
          )
        "
      >

      <div style="flex:1">

        <div class="habit-title">
          ${h.icon} ${h.title}
        </div>

        <div class="habit-meta">
          ${h.meta}
        </div>

      </div>

      ${extra}

    </div>
  `;
}

/* =========================
   DAYS
========================= */

async function toggleHabit(
  date,
  id,
  value
) {

  const u = user();

  if (!u.days[date]) {
    u.days[date] = {
      checks:{},
      steps:"",
      pages:"",
      minutes:"",
      meal:""
    };
  }

  if (!u.days[date].checks) {
    u.days[date].checks = {};
  }

  u.days[date].checks[id] = value;

  await saveDay(date);

  render();
}

async function setExtra(
  date,
  key,
  value
) {

  const u = user();

  if (!u.days[date]) {
    u.days[date] = {
      checks:{},
      steps:"",
      pages:"",
      minutes:"",
      meal:""
    };
  }

  u.days[date][key] = value;

  await saveDay(date);
}

async function saveDay(date) {

  const u = user();
  const d = u.days[date];

  const { data, error } =
    await db
      .from("days")
      .upsert(
        {
          user_id: u.id,
          day_date: date,
          checks: d.checks || {},
          steps: d.steps || null,
          pages: d.pages || null,
          minutes: d.minutes || null,
          meal: d.meal || null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict:"user_id,day_date"
        }
      )
      .select()
      .single();

  if (error) {
    console.error(error);
    toast(
      "Ошибка сохранения: " +
      error.message
    );
    return;
  }

  d.id = data.id;
}

async function saveNote() {

  const text =
    document.getElementById("note").value;

  const u = user();

  u.notes[today()] = text;

  const { error } =
    await db
      .from("notes")
      .upsert(
        {
          user_id: u.id,
          note_date: today(),
          text,
          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:"user_id,note_date"
        }
      );

  if (error) {
    toast(
      "Ошибка сохранения заметки"
    );
    console.error(error);
    return;
  }

  toast("Заметка сохранена ✨");
}

async function saveMeal() {

  const meal =
    document.getElementById("meal").value;

  const u = user();

  if (!u.days[today()]) {
    u.days[today()] = {
      checks:{},
      steps:"",
      pages:"",
      minutes:"",
      meal:""
    };
  }

  u.days[today()].meal = meal;

  await saveDay(today());

  toast("Питание сохранено 🍽️");
}

async function changeStart() {

  const value =
    document.getElementById("startDate").value;

  if (!value) return;

  const u = user();

  const { error } =
    await db
      .from("profiles")
      .update({
        start_date:value
      })
      .eq("id",u.id);

  if (error) {
    toast(
      "Ошибка изменения даты"
    );
    return;
  }

  u.startDate = value;

  render();

  toast(
    "Дата старта обновлена"
  );
}

/* =========================
   CALENDAR
========================= */

function renderCalendar() {

  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();

  const first =
    new Date(y,m,1);

  const days =
    new Date(y,m+1,0).getDate();

  const offset =
    (first.getDay()+6)%7;

  let cells =
    [
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Вс"
    ]
    .map(x =>
      `<div class="weekday">${x}</div>`
    )
    .join("");

  for (
    let i=0;
    i<offset;
    i++
  ) {
    cells +=
      `<div class="daycell out"></div>`;
  }

  for (
    let d=1;
    d<=days;
    d++
  ) {

    const date =
      iso(new Date(y,m,d));

    const st =
      eligible(date)
        ? statsFor(date)
        : null;

    let cls =
      "daycell";

    if (date === today())
      cls += " current";

    if (st?.pct === 100)
      cls += " done";
    else if (st?.pct > 0)
      cls += " partial";

    cells += `
      <button
        class="${cls}"
        onclick="openDay('${date}')"
      >

        <div class="daynum">
          ${d}
        </div>

        <div class="daystatus">
          ${
            st
              ? `День ${dayNum(date)} · ${st.pct}%`
              : "до старта"
          }
        </div>

      </button>
    `;
  }

  document.getElementById(
    "view-calendar"
  ).innerHTML = `

    <div class="card">

      <div class="calendar-head">

        <button
          class="btn secondary"
          onclick="moveMonth(-1)"
        >
          ‹
        </button>

        <h2>
          ${new Date(y,m,1)
            .toLocaleDateString(
              "ru-RU",
              {
                month:"long",
                year:"numeric"
              }
            )}
        </h2>

        <button
          class="btn secondary"
          onclick="moveMonth(1)"
        >
          ›
        </button>

      </div>

      <div class="month-grid">
        ${cells}
      </div>

      <p
        class="muted"
        style="margin-bottom:0"
      >
        🟢 100% · 🟡 частично · ⚪ пусто · 🔵 сегодня
      </p>

    </div>
  `;
}

function moveMonth(x) {

  calCursor.setMonth(
    calCursor.getMonth()+x
  );

  renderCalendar();
}

function openDay(date) {

  const st = statsFor(date);
  const d = dayData(date);

  openModal(`

    <h2>
      ${fmtDate(date)}
      · День ${dayNum(date)}
    </h2>

    <div class="kpi">
      ${st.pct}%
    </div>

    <p class="muted">
      ${st.done}/${st.total} выполнено
    </p>

    ${
      habitsFor(date)
        .map(h => `
          <div class="habit">

            <span>
              ${d.checks[h.id]
                ? "✅"
                : "○"}
            </span>

            <div>
              <b>
                ${h.icon} ${h.title}
              </b>
            </div>

          </div>
        `)
        .join("")
    }

    <h3>📝 Заметка</h3>

    <p>
      ${user().notes[date] ||
        "Нет заметки."}
    </p>

  `);
}

/* =========================
   PROGRESS
========================= */

function renderProgress() {

  const o = overall();
  const u = user();

  const a = initialWeight();
  const b = lastWeight();

  const rates =
    defaultHabits
      .map(h => {

        const rate =
          habitRate(h.id);

        return `
          <div class="metric-row">

            <div>
              ${h.icon} ${h.title}
            </div>

            <div>
              <b>${rate}%</b>
            </div>

            <div class="bar">
              <i
                style="width:${rate}%"
              ></i>
            </div>

          </div>
        `;
      })
      .join("");

  document.getElementById(
    "view-progress"
  ).innerHTML = `

    <div class="grid">

      <div class="card">

        <div class="muted">
          Среднее выполнение
        </div>

        <div class="kpi">
          ${o.avg}%
        </div>

        <p>
          ${o.full}
          полностью выполненных дней
          из ${o.days}
        </p>

      </div>

      <div class="card">

        <div class="muted">
          Серия
        </div>

        <div class="kpi">
          🔥 ${currentStreak()}
        </div>

        <p>
          Лучшая:
          ${bestStreak()} дней
        </p>

      </div>

    </div>

    <div class="card">

      <h2>
        📊 Привычки
      </h2>

      <div class="table-like">
        ${rates}
      </div>

    </div>

    <div class="card">

      <h2>
        ⚖️ Вес и замеры
      </h2>

      <div class="grid">

        <div>
          <div class="muted">
            Начальный вес
          </div>

          <div class="kpi">
            ${a ?? "—"} кг
          </div>
        </div>

        <div>
          <div class="muted">
            Текущий вес
          </div>

          <div class="kpi">
            ${b ?? "—"} кг
          </div>
        </div>

      </div>

      <p>
        ${
          a != null && b != null
            ? `Результат:
               <b>${(b-a).toFixed(1)} кг</b>`
            : "Добавь первую запись веса."
        }
      </p>

      <button
        class="btn"
        onclick="weightModal()"
      >
        Добавить вес / замеры
      </button>

    </div>

    <div class="card">

      <h2>
        💄 Фонд красоты
      </h2>

      <div class="kpi">
        ${beautyFund()
          .toLocaleString("ru-RU")} сом
      </div>

      <p class="muted">
        +1 000 сом за каждый
        полный потерянный килограмм.
      </p>

    </div>
  `;
}

function weightModal() {

  openModal(`

    <h2>
      ⚖️ Еженедельный контроль
    </h2>

    <div class="field">

      <label>
        Вес, кг
      </label>

      <input
        id="w"
        class="input"
        type="number"
        step="0.1"
      >

    </div>

    <div class="grid">

      ${
        [
          "Грудь",
          "Талия",
          "Живот",
          "Бёдра"
        ]
        .map((x,i) => `
          <div class="field">

            <label>
              ${x}, см
            </label>

            <input
              id="m${i}"
              class="input"
              type="number"
              step="0.1"
            >

          </div>
        `)
        .join("")
      }

    </div>

    <button
      class="btn"
      onclick="saveWeight()"
    >
      Сохранить
    </button>
  `);
}

async function saveWeight() {

  const v =
    parseFloat(
      document.getElementById("w").value
    );

  if (!v) return;

  const u = user();

  const { data: weight, error } =
    await db
      .from("weights")
      .insert({
        user_id:u.id,
        record_date:today(),
        value:v
      })
      .select()
      .single();

  if (error) {
    console.error(error);
    toast(
      "Ошибка сохранения веса"
    );
    return;
  }

  u.weights.push({
    id:weight.id,
    date:today(),
    value:v
  });

  const names = [
    "chest",
    "waist",
    "belly",
    "hips"
  ];

  const vals = {};

  names.forEach((name,i) => {

    const x =
      parseFloat(
        document.getElementById(
          "m"+i
        ).value
      );

    if (!isNaN(x)) {
      vals[name] = x;
    }
  });

  const hasMeasures =
    Object.keys(vals).length > 0;

  if (hasMeasures) {

    const {
      data: measurement,
      error: measurementError
    } = await db
      .from("measurements")
      .insert({
        user_id:u.id,
        record_date:today(),
        ...vals
      })
      .select()
      .single();

    if (measurementError) {
      console.error(
        measurementError
      );
    } else {
      u.measurements.push({
        id:measurement.id,
        date:today(),
        ...vals
      });
    }
  }

  closeModal();

  render();

  toast(
    "Данные сохранены ✨"
  );
}

/* =========================
   REWARDS
========================= */

function rewardCount(type,value) {

  const lost = lostKg();
  const st = currentStreak();

  if (type === "kg")
    return Math.floor(lost/value);

  if (type === "streak")
    return Math.floor(st/value);

  return 0;
}

function rewardKey(
  type,
  value,
  index
) {
  return `${type}_${value}_${index}`;
}

function renderRewards() {

  const lost = lostKg();
  const w = lastWeight();
  const st = currentStreak();

  let cards = [];

  const repeatDefs = [

    {
      type:"kg",
      value:5,
      icon:"💆",
      title:"Стоматолог или косметолог",
      label:"за каждые −5 кг"
    },

    {
      type:"kg",
      value:10,
      icon:"🍕",
      title:"Читмил",
      label:"за каждые −10 кг"
    },

    {
      type:"streak",
      value:30,
      icon:"🏊‍♀️",
      title:"Бассейн / SPA",
      label:"за каждые 30 дней без срыва"
    }

  ];

  repeatDefs.forEach(r => {

    const count =
      rewardCount(
        r.type,
        r.value
      );

    for (
      let i=1;
      i<=Math.max(count,1);
      i++
    ) {

      const unlocked =
        i <= count;

      const key =
        rewardKey(
          r.type,
          r.value,
          i
        );

      const claimed =
        !!user().rewards[key];

      cards.push(`

        <div
          class="card reward
          ${unlocked
            ? "unlocked"
            : "locked"}"
        >

          <div class="reward-icon">
            ${r.icon}
          </div>

          <div style="flex:1">

            <h3>
              ${r.title}
              ${i>1
                ? ` №${i}`
                : ""}
            </h3>

            <div class="muted">
              ${r.label}
              · порог
              ${r.value*i}
              ${
                r.type==="kg"
                  ? " кг"
                  : " дней"
              }
            </div>

          </div>

          <div>
            ${
              claimed
                ? "☑️"
                : unlocked
                  ? "🎉"
                  : "🔒"
            }
          </div>

          ${
            unlocked && !claimed
              ? `
                <button
                  class="btn"
                  onclick="
                    claim('${key}')
                  "
                >
                  Получена
                </button>
              `
              : ""
          }

        </div>
      `);
    }
  });

  [
    {
      id:"75",
      icon:"💋",
      title:"Сделать губы",
      rule:"Достичь 75 кг",
      value:75
    },
    {
      id:"65",
      icon:"📸",
      title:"Профессиональная фотосессия",
      rule:"Достичь 65 кг",
      value:65
    },
    {
      id:"60",
      icon:"✈️🛍️",
      title:"Путешествие + шопинг",
      rule:"Достичь 60 кг",
      value:60
    }
  ].forEach(r => {

    const unlocked =
      w != null &&
      w <= r.value;

    const claimed =
      !!user().rewards[r.id];

    cards.push(`

      <div
        class="card reward
        ${unlocked
          ? "unlocked"
          : "locked"}"
      >

        <div class="reward-icon">
          ${r.icon}
        </div>

        <div style="flex:1">

          <h3>
            ${r.title}
          </h3>

          <div class="muted">
            ${r.rule}
          </div>

        </div>

        <div>
          ${
            claimed
              ? "☑️"
              : unlocked
                ? "🎉"
                : "🔒"
          }
        </div>

        ${
          unlocked && !claimed
            ? `
              <button
                class="btn"
                onclick="
                  claim('${r.id}')
                "
              >
                Получена
              </button>
            `
            : ""
        }

      </div>
    `);
  });

  document.getElementById(
    "view-rewards"
  ).innerHTML = `

    <div class="hero">

      <div class="muted">
        💄 Фонд красоты
      </div>

      <div class="kpi">
        ${beautyFund()
          .toLocaleString("ru-RU")} сом
      </div>

      <p class="muted">
        Потеряно:
        ${lost.toFixed(1)} кг
        · текущая серия:
        🔥 ${st} дней
      </p>

    </div>

    <h2 style="margin:20px 0 12px">
      🏆 Награды
    </h2>

    ${cards.join("")}
  `;
}

async function claim(id) {

  const u = user();

  if (u.rewards[id]) return;

  const { error } =
    await db
      .from("rewards")
      .insert({
        user_id:u.id,
        reward_key:id,
        claimed_at:
          new Date().toISOString()
      });

  if (error) {
    console.error(error);

    toast(
      "Ошибка сохранения награды"
    );

    return;
  }

  u.rewards[id] = true;

  render();

  toast(
    "Награда отмечена 🎉"
  );
}

/* =========================
   US
========================= */

function renderUs() {

  const people =
    Object.values(state.users);

  const cards =
    people
      .map(u => {

        const old =
          state.active;

        state.active =
          u.name;

        const s =
          statsFor(today());

        const st =
          currentStreak();

        const w =
          lastWeight();

        const a =
          initialWeight();

        const todayData =
          dayData(today());

        const note =
          u.notes[today()] || "";

        const meal =
          todayData.meal || "";

        const measures =
          u.measurements.length
            ? u.measurements[
                u.measurements.length-1
              ]
            : null;

        state.active = old;

        const habits =
          habitsFor(today())
            .map(h => `

              <div
                class="habit"
                style="padding:8px 0"
              >

                <span>
                  ${
                    todayData.checks[h.id]
                      ? "✅"
                      : "○"
                  }
                </span>

                <div>
                  <b>
                    ${h.icon}
                    ${h.title}
                  </b>
                </div>

              </div>
            `)
            .join("");

        return `

          <div class="card">

            <div class="row">

              <h2>
                ${u.name}
              </h2>

              <span class="tag">
                ${
                  u.name === old
                    ? "Ты"
                    : "Общий доступ"
                }
              </span>

            </div>

            <div class="stats">

              <div class="stat">
                Сегодня
                <strong>
                  ${s.done}/${s.total}
                </strong>
              </div>

              <div class="stat">
                Процент
                <strong>
                  ${s.pct}%
                </strong>
              </div>

              <div class="stat">
                Серия
                <strong>
                  🔥 ${st}
                </strong>
              </div>

            </div>

            <div
              class="grid"
              style="margin-top:12px"
            >

              <div class="stat">

                <div class="muted">
                  ⚖️ Вес
                </div>

                <strong>
                  ${
                    w != null
                      ? w + " кг"
                      : "—"
                  }
                </strong>

                <small>
                  ${
                    a != null
                      ? `старт ${a} кг`
                      : "нет данных"
                  }
                </small>

              </div>

              <div class="stat">

                <div class="muted">
                  💄 Фонд
                </div>

                <strong>
                  ${beautyFund()
                    .toLocaleString(
                      "ru-RU"
                    )} сом
                </strong>

              </div>

            </div>

            <details style="margin-top:14px">

              <summary>
                <b>
                  📋 Привычки сегодня
                </b>
              </summary>

              ${habits}

              ${
                todayData.steps
                  ? `
                    <p class="muted">
                      👣 Шаги:
                      ${todayData.steps}
                    </p>
                  `
                  : ""
              }

              ${
                todayData.pages
                  ? `
                    <p class="muted">
                      📖 Страниц:
                      ${todayData.pages}
                    </p>
                  `
                  : ""
              }

              ${
                todayData.minutes
                  ? `
                    <p class="muted">
                      🎬 Развлекательный
                      контент:
                      ${todayData.minutes}
                      мин
                    </p>
                  `
                  : ""
              }

            </details>

            <details style="margin-top:12px">

              <summary>
                <b>
                  🍽️ Питание
                </b>
              </summary>

              <p>
                ${
                  meal ||
                  "Сегодня ничего не записано."
                }
              </p>

            </details>

            <details style="margin-top:12px">

              <summary>
                <b>
                  📝 Заметка за сегодня
                </b>
              </summary>

              <p>
                ${
                  note ||
                  "Сегодня заметки нет."
                }
              </p>

            </details>

            <details style="margin-top:12px">

              <summary>
                <b>
                  📏 Последние замеры
                </b>
              </summary>

              ${
                measures
                  ? `
                    <p>
                      Грудь:
                      ${measures.chest ?? "—"} см
                      · Талия:
                      ${measures.waist ?? "—"} см
                      · Живот:
                      ${measures.belly ?? "—"} см
                      · Бёдра:
                      ${measures.hips ?? "—"} см
                    </p>
                  `
                  : `
                    <p>
                      Замеры пока
                      не внесены.
                    </p>
                  `
              }

            </details>

          </div>
        `;
      })
      .join("");

  const me =
    user();

  document.getElementById(
    "view-us"
  ).innerHTML = `

    <div class="hero">

      <h2>
        👯‍♀️ Мы вдвоём
      </h2>

      <p class="muted">
        Общий доступ: вес, замеры,
        питание, заметки, привычки,
        серии и награды.
      </p>

    </div>

    ${cards}

    <div class="card">

      <h2>
        🎯 Цели
      </h2>

      <div class="field">

        <label>
          Социальные сети до Нового года
        </label>

        ${
          [
            "Instagram",
            "TikTok",
            "Threads",
            "Другое"
          ]
          .map(x => `

            <label
              style="
                display:block;
                margin:7px 0
              "
            >

              <input
                type="checkbox"
                ${
                  me.goals.socials
                    .includes(x)
                    ? "checked"
                    : ""
                }
                onchange="
                  toggleSocial(
                    '${x}',
                    this.checked
                  )
                "
              >

              ${x}

            </label>
          `)
          .join("")
        }

      </div>

      <label class="habit">

        <input
          type="checkbox"
          ${
            me.goals.alcohol
              ? "checked"
              : ""
          }
          onchange="
            toggleGoal(
              'alcohol',
              this.checked
            )
          "
        >

        <span>
          🍷 Не употреблять алкоголь
          до Нового года
        </span>

      </label>

      <label class="habit">

        <input
          type="checkbox"
          ${
            me.goals.vision
              ? "checked"
              : ""
          }
          onchange="
            toggleGoal(
              'vision',
              this.checked
            )
          "
        >

        <span>
          🗺️ Сделать карту желаний
        </span>

      </label>

      <label class="habit">

        <input
          type="checkbox"
          ${
            me.goals.wishlist
              ? "checked"
              : ""
          }
          onchange="
            toggleGoal(
              'wishlist',
              this.checked
            )
          "
        >

        <span>
          📝 Составить список желаний
        </span>

      </label>

    </div>
  `;
}

async function toggleSocial(x,value) {

  const u = user();

  const a =
    u.goals.socials;

  if (value && !a.includes(x))
    a.push(x);

  if (!value) {
    const i =
      a.indexOf(x);

    if (i >= 0)
      a.splice(i,1);
  }

  await saveGoals();
}

async function toggleGoal(
  key,
  value
) {

  user().goals[key] =
    value;

  await saveGoals();
}

async function saveGoals() {

  const u = user();

  const { error } =
    await db
      .from("goals")
      .upsert(
        {
          user_id:u.id,
          socials:u.goals.socials,
          alcohol:u.goals.alcohol,
          wishlist:u.goals.wishlist,
          vision:u.goals.vision,
          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:"user_id"
        }
      );

  if (error) {
    console.error(error);
    toast(
      "Ошибка сохранения цели"
    );
    return;
  }

  render();
}

/* =========================
   PROFILE
========================= */

function openProfile() {

  openModal(`

    <h2>
      👤 Профиль
    </h2>

    <p>
      Выбери пользователя.
    </p>

    ${
      Object.keys(state.users)
        .map(n => `

          <button
            class="btn ${
              n === state.active
                ? ""
                : "secondary"
            }"
            style="
              width:100%;
              margin:6px 0
            "
            onclick="
              selectUser('${n}')
            "
          >
            ${n}
          </button>
        `)
        .join("")
    }

    <hr>

    <button
      class="btn secondary"
      style="width:100%"
      onclick="logout()"
    >
      Выйти
    </button>

  `);
}

function selectUser(name) {

  state.active = name;

  closeModal();

  render();
}

/* =========================
   MODAL / TOAST
========================= */

function openModal(html) {

  const modal =
    document.getElementById("modal");

  const content =
    document.getElementById(
      "modalContent"
    );

  if (!modal || !content)
    return;

  content.innerHTML = html;

  modal.classList.remove("hidden");
}

function closeModal() {

  const modal =
    document.getElementById("modal");

  if (modal)
    modal.classList.add("hidden");
}

function toast(text) {

  const x =
    document.createElement("div");

  x.className = "toast";

  x.textContent = text;

  document.body.appendChild(x);

  setTimeout(
    () => x.remove(),
    1800
  );
}

/* =========================
   START
========================= */

function connectUI() {

  const modalClose =
    document.getElementById(
      "modalClose"
    );

  const modal =
    document.getElementById("modal");

  if (modalClose)
    modalClose.onclick =
      closeModal;

  if (modal) {
    modal.addEventListener(
      "click",
      e => {
        if (e.target.id === "modal")
          closeModal();
      }
    );
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(b => {

      b.onclick = () => {
        currentView =
          b.dataset.view;

        render();
      };

    });

  const profileBtn =
    document.getElementById(
      "profileBtn"
    );

  if (profileBtn) {
    profileBtn.onclick =
      openProfile;
  }
}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      connectUI();
      waitForSupabase();
    }
  );

} else {

  connectUI();
  waitForSupabase();

}
