const SUPABASE_URL = "https://vpfckslzjpvaurxitkpk.supabase.co";
const SUPABASE_KEY = "sb_publishable_F9HeyytRDxbbD-Q6j2_SuQ_SFKL8qOb";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =========================================================
   HABITS
========================================================= */

const defaultHabits = [
  {
    id: "water",
    icon: "💧",
    title: "2 литра воды",
    meta: "Цель: 2 000 мл"
  },
  {
    id: "lemon",
    icon: "🍋",
    title: "Вода с лимоном",
    meta: "Утром"
  },
  {
    id: "wake",
    icon: "⏰",
    title: "Подъём в 7:00",
    meta: "Начать день вовремя"
  },
  {
    id: "exercise",
    icon: "☀️",
    title: "Утренняя зарядка",
    meta: "Ежедневно"
  },
  {
    id: "steps",
    icon: "👣",
    title: "10 000 шагов",
    meta: "Можно указать фактическое количество"
  },
  {
    id: "food",
    icon: "🍽️",
    title: "Записать всё съеденное",
    meta: "Питание за день"
  },
  {
    id: "dinner",
    icon: "🥛",
    title: "Лёгкая замена ужина",
    meta: "Можно изменить в настройках"
  },
  {
    id: "book",
    icon: "📖",
    title: "20 страниц книги",
    meta: "Можно указать фактическое число"
  },
  {
    id: "screenmeal",
    icon: "📵",
    title: "Без телефона и ТВ во время еды",
    meta: "Осознанное питание"
  },
  {
    id: "entertainment",
    icon: "🎬",
    title: "Развлекательный контент ≤ 1 часа",
    meta: "Можно указать минуты"
  },
  {
    id: "sleep",
    icon: "😴",
    title: "Сон 23:00–00:00",
    meta: ""
  }
];

/* =========================================================
   STATE
========================================================= */

let currentAuthUserId = null;
let activeUserId = null;

let users = {};
let profiles = {};

let currentView = "today";
let calCursor = new Date();

let authLoading = false;

/* =========================================================
   HELPERS
========================================================= */

function nameOf(id) {
  return users[id]?.name ||
    profiles[id]?.name ||
    "Пользователь";
}

function today() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function fmtDate(s) {
  if (!s) return "—";

  const normalized = normalizeStartDate(s);

  if (!normalized) return "—";

  return new Date(
    normalized + "T00:00:00"
  ).toLocaleDateString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}

function user() {
  return users[activeUserId];
}

function allUsers() {
  return Object.values(users);
}

function toast(text) {
  const x = document.createElement("div");

  x.className = "toast";
  x.textContent = text;

  document.body.appendChild(x);

  setTimeout(() => x.remove(), 1800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
  ВАЖНО:

  start_date теперь хранится ТОЛЬКО в goals.

  Никаких значений по умолчанию.
  Никакого 20-го числа.
*/

function normalizeStartDate(value) {
  if (!value) return null;

  const str = String(value).trim();

  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return null;

  const result =
    `${match[1]}-${match[2]}-${match[3]}`;

  const test =
    new Date(result + "T00:00:00");

  if (
    isNaN(test.getTime()) ||
    iso(test) !== result
  ) {
    return null;
  }

  return result;
}

function ensureDayObject(userId, date) {
  if (!users[userId]) return null;

  if (!users[userId].days[date]) {
    users[userId].days[date] = {
      checks: {},
      steps: "",
      pages: "",
      minutes: "",
      meal: ""
    };
  }

  if (!users[userId].days[date].checks) {
    users[userId].days[date].checks = {};
  }

  return users[userId].days[date];
}

/* =========================================================
   AUTH
========================================================= */

async function init() {
  try {
    const {
      data: { session },
      error
    } = await sb.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      renderLogin();
      return;
    }

    currentAuthUserId = session.user.id;

    await loadAllData();

    const profile =
      Object.values(profiles).find(
        p =>
          String(p.auth_user_id || "").trim() ===
          String(currentAuthUserId).trim()
      );

    if (!profile) {
      document.body.innerHTML = `
        <div style="
          padding:40px;
          font-family:Arial,sans-serif;
        ">
          <h2>Профиль не найден</h2>

          <p>
            Для этого аккаунта нет записи
            в таблице profiles.
          </p>

          <button
            onclick="logout()"
            class="btn"
          >
            Выйти
          </button>
        </div>
      `;

      return;
    }

    activeUserId = profile.id;

    /*
      Дата старта уже была загружена
      из goals.start_date внутри loadAllData().
    */

    render();

  } catch (error) {
    console.error("INIT ERROR:", error);

    renderLogin(
      error?.message ||
      "Не удалось загрузить приложение"
    );
  }
}

function renderLogin(error = "") {
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:#f7f2ec;
      font-family:Arial,sans-serif;
    ">

      <div style="
        width:100%;
        max-width:420px;
        background:#fffdf9;
        border-radius:24px;
        padding:30px;
        box-shadow:0 12px 35px rgba(66,48,35,.08);
      ">

        <div style="
          text-align:center;
          margin-bottom:25px;
        ">

          <div style="font-size:42px">
            🌱
          </div>

          <h1 style="margin:8px 0">
            Новая Я
          </h1>

          <p style="color:#8b817a">
            365 дней вместе
          </p>

        </div>

        <div class="field">

          <label>Email</label>

          <input
            id="loginEmail"
            class="input"
            type="email"
            autocomplete="username"
            placeholder="Введите email"
          >

        </div>

        <div
          class="field"
          style="margin-top:12px"
        >

          <label>Пароль</label>

          <input
            id="loginPassword"
            class="input"
            type="password"
            autocomplete="current-password"
            placeholder="Введите пароль"
          >

        </div>

        <button
          id="loginBtn"
          class="btn"
          style="
            width:100%;
            margin-top:18px;
          "
          onclick="login()"
        >
          Войти
        </button>

        ${
          error
            ? `
              <p style="
                color:#b44;
                margin-top:15px;
              ">
                ${escapeHtml(error)}
              </p>
            `
            : ""
        }

        <p style="
          color:#8b817a;
          font-size:13px;
          text-align:center;
          margin-top:20px;
        ">
          Вход выполняется через Supabase
        </p>

      </div>
    </div>
  `;

  setTimeout(() => {
    const password =
      document.getElementById("loginPassword");

    if (password) {
      password.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            login();
          }
        }
      );
    }
  }, 0);
}

/*
  ИСПРАВЛЕНИЕ ЛОГИНА.

  После signInWithPassword мы НЕ запускаем
  второй параллельный процесс через auth listener.

  Здесь просто получаем сессию,
  загружаем данные и открываем приложение.
*/

async function login() {
  if (authLoading) return;

  const email =
    document
      .getElementById("loginEmail")
      ?.value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      ?.value;

  if (!email || !password) {
    toast("Введи email и пароль");
    return;
  }

  authLoading = true;

  const btn =
    document.getElementById("loginBtn");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Входим...";
  }

  try {
    const {
      data,
      error
    } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data?.user || !data?.session) {
      throw new Error(
        "Сессия не была создана"
      );
    }

    currentAuthUserId =
      data.user.id;

    /*
      ВАЖНО:

      loadAllData вызывается только здесь.
      onAuthStateChange больше НЕ вызывает init().
    */

    await loadAllData();

    const profile =
      Object.values(profiles).find(
        p =>
          String(p.auth_user_id || "").trim() ===
          String(currentAuthUserId).trim()
      );

    if (!profile) {
      await sb.auth.signOut();

      throw new Error(
        "Для этого аккаунта не найден профиль"
      );
    }

    activeUserId =
      profile.id;

    render();

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    renderLogin(
      error?.message ||
      "Ошибка входа"
    );

  } finally {
    authLoading = false;
  }
}

async function logout() {
  try {
    await sb.auth.signOut();
  } catch (error) {
    console.error(error);
  }

  currentAuthUserId = null;
  activeUserId = null;
  users = {};
  profiles = {};

  location.reload();
}

/*
  ВАЖНО:

  SIGNED_IN здесь НЕ запускает init().
  Это устраняет гонку при входе.
*/

sb.auth.onAuthStateChange(
  event => {

    if (event === "SIGNED_OUT") {

      currentAuthUserId = null;
      activeUserId = null;

      users = {};
      profiles = {};

      location.reload();
    }

  }
);

/* =========================================================
   USER OBJECT
========================================================= */

function emptyUser(profile) {
  return {
    id: profile.id,

    name:
      profile.name ||
      "Пользователь",

    authUserId:
      profile.auth_user_id ||
      null,

    /*
      startDate будет установлен
      из goals.start_date после загрузки goals.
    */

    startDate: null,

    days: {},

    weights: [],

    measurements: [],

    goals: {
      socials: [],
      alcohol: false,
      wishlist: false,
      vision: false,
      start_date: null
    },

    rewards: {},

    notes: {}
  };
}

/* =========================================================
   LOAD ALL DATA
========================================================= */

async function loadAllData() {

  /*
    1. PROFILES

    Здесь НИЧЕГО не читаем про start_date.
  */

  const profilesResult =
    await sb
      .from("profiles")
      .select("*");

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  profiles = {};

  for (
    const row of
    profilesResult.data || []
  ) {
    profiles[row.id] = row;
  }

  users = {};

  for (
    const profile of
    profilesResult.data || []
  ) {
    users[profile.id] =
      emptyUser(profile);
  }

  const ids =
    Object.keys(users);

  if (!ids.length) {
    throw new Error(
      "В таблице profiles нет пользователей."
    );
  }

  /*
    2. ОСТАЛЬНЫЕ ТАБЛИЦЫ
  */

  const [
    daysResult,
    goalsResult,
    measurementsResult,
    notesResult,
    rewardsResult,
    weightsResult
  ] = await Promise.all([

    sb
      .from("days")
      .select("*")
      .in("user_id", ids),

    sb
      .from("goals")
      .select("*")
      .in("user_id", ids),

    sb
      .from("measurements")
      .select("*")
      .in("user_id", ids),

    sb
      .from("notes")
      .select("*")
      .in("user_id", ids),

    sb
      .from("rewards")
      .select("*")
      .in("user_id", ids),

    sb
      .from("weights")
      .select("*")
      .in("user_id", ids)
  ]);

  const results = [
    daysResult,
    goalsResult,
    measurementsResult,
    notesResult,
    rewardsResult,
    weightsResult
  ];

  for (
    const result of results
  ) {
    if (result.error) {
      throw result.error;
    }
  }

  /* =====================================================
     DAYS
  ===================================================== */

  for (
    const row of
    daysResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    users[row.user_id]
      .days[row.day_date] = {

        id: row.id,

        checks:
          row.checks || {},

        steps:
          row.steps ?? "",

        pages:
          row.pages ?? "",

        minutes:
          row.minutes ?? "",

        meal:
          row.meal || ""
      };
  }

  /* =====================================================
     GOALS

     start_date теперь ТОЛЬКО ЗДЕСЬ.
  ===================================================== */

  for (
    const row of
    goalsResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    const startDate =
      normalizeStartDate(
        row.start_date
      );

    users[row.user_id].goals = {

      socials:
        Array.isArray(row.socials)
          ? row.socials
          : [],

      alcohol:
        !!row.alcohol,

      wishlist:
        !!row.wishlist,

      vision:
        !!row.vision,

      start_date:
        startDate
    };

    /*
      Единственное место,
      откуда users.startDate получает значение.
    */

    users[row.user_id].startDate =
      startDate;
  }

  /* =====================================================
     MEASUREMENTS
  ===================================================== */

  for (
    const row of
    measurementsResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    users[row.user_id]
      .measurements
      .push({

        id: row.id,

        date:
          row.record_date,

        chest:
          row.chest,

        waist:
          row.waist,

        belly:
          row.belly,

        hips:
          row.hips
      });
  }

  /* =====================================================
     NOTES
  ===================================================== */

  for (
    const row of
    notesResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    users[row.user_id]
      .notes[row.note_date] =
      row.text || "";
  }

  /* =====================================================
     REWARDS
  ===================================================== */

  for (
    const row of
    rewardsResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    users[row.user_id]
      .rewards[row.reward_key] =
      true;
  }

  /* =====================================================
     WEIGHTS
  ===================================================== */

  for (
    const row of
    weightsResult.data || []
  ) {

    if (!users[row.user_id]) {
      continue;
    }

    users[row.user_id]
      .weights
      .push({

        id: row.id,

        date:
          row.record_date,

        value:
          Number(row.value)
      });
  }

  /* =====================================================
     SORT
  ===================================================== */

  for (
    const id of ids
  ) {

    users[id]
      .measurements
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date)
      );

    users[id]
      .weights
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date)
      );
  }
}

/* =========================================================
   DAYS
========================================================= */

function dayNumFor(userId, date) {

  const start =
    users[userId]?.startDate;

  if (!start) {
    return 0;
  }

  const startDate =
    new Date(
      start + "T00:00:00"
    );

  const d =
    new Date(
      date + "T00:00:00"
    );

  return Math.floor(
    (d - startDate) /
    86400000
  ) + 1;
}

function dayNum(date) {
  return dayNumFor(
    activeUserId,
    date
  );
}

function eligible(date) {
  return dayNum(date) >= 1;
}

function dayData(date) {

  return users[activeUserId]
    ?.days?.[date] || {

      checks: {},
      steps: "",
      pages: "",
      minutes: "",
      meal: ""
    };
}

function yoga(date) {

  const n =
    dayNum(date);

  return (
    n >= 1 &&
    n % 2 === 1
  );
}

function habitsFor(date) {

  return [
    ...defaultHabits,

    ...(yoga(date)
      ? [
          {
            id: "yoga",
            icon: "🧘",
            title: "Йога 15 минут",
            meta: "Сегодня день йоги"
          }
        ]
      : [])
  ];
}

function habitsForUser(
  userId,
  date
) {

  const n =
    dayNumFor(
      userId,
      date
    );

  return [
    ...defaultHabits,

    ...(n >= 1 && n % 2 === 1
      ? [
          {
            id: "yoga",
            icon: "🧘",
            title: "Йога 15 минут",
            meta: "Сегодня день йоги"
          }
        ]
      : [])
  ];
}

function statsFor(
  date,
  userId = activeUserId
) {

  /*
    ВАЖНО:

    statsFor по умолчанию использует
    ТОЛЬКО activeUserId.

    Общие данные сюда не попадают.
  */

  const d =
    users[userId]?.days?.[date]
    || {
      checks: {}
    };

  const n =
    dayNumFor(
      userId,
      date
    );

  const hs = [
    ...defaultHabits,

    ...(n >= 1 && n % 2 === 1
      ? [{ id: "yoga" }]
      : [])
  ];

  const done =
    hs.filter(
      h => !!d.checks?.[h.id]
    ).length;

  return {

    done,

    total:
      hs.length,

    pct:
      hs.length
        ? Math.round(
            done /
            hs.length *
            100
          )
        : 0
  };
}

function challengeDays(
  userId = activeUserId
) {

  const start =
    users[userId]?.startDate;

  if (!start) {
    return 0;
  }

  const startDate =
    new Date(
      start +
      "T00:00:00"
    );

  const now =
    new Date(
      today() +
      "T00:00:00"
    );

  if (now < startDate) {
    return 0;
  }

  return Math.floor(
    (now - startDate) /
    86400000
  ) + 1;
}

function currentStreak(
  userId = activeUserId
) {

  let n = 0;

  let d =
    new Date(
      today() +
      "T00:00:00"
    );

  for (
    let i = 0;
    i < 10000;
    i++
  ) {

    const s =
      iso(d);

    if (
      dayNumFor(
        userId,
        s
      ) < 1
    ) {
      break;
    }

    if (
      statsFor(
        s,
        userId
      ).pct === 100
    ) {

      n++;

    } else {

      break;
    }

    d.setDate(
      d.getDate() - 1
    );
  }

  return n;
}

function bestStreak(
  userId = activeUserId
) {

  let best = 0;
  let run = 0;

  const start =
    users[userId]?.startDate;

  if (!start) {
    return 0;
  }

  const startDate =
    new Date(
      start +
      "T00:00:00"
    );

  const end =
    new Date(
      today() +
      "T00:00:00"
    );

  if (end < startDate) {
    return 0;
  }

  for (
    let d = new Date(startDate);
    d <= end;
    d.setDate(
      d.getDate() + 1
    )
  ) {

    const p =
      statsFor(
        iso(d),
        userId
      ).pct;

    if (p === 100) {

      run++;

      best =
        Math.max(
          best,
          run
        );

    } else {

      run = 0;
    }
  }

  return best;
}

function overall(
  userId = activeUserId
) {

  let total = 0;
  let sum = 0;
  let full = 0;

  const start =
    users[userId]?.startDate;

  if (!start) {
    return {
      days: 0,
      avg: 0,
      full: 0
    };
  }

  const startDate =
    new Date(
      start +
      "T00:00:00"
    );

  const end =
    new Date(
      today() +
      "T00:00:00"
    );

  if (end < startDate) {
    return {
      days: 0,
      avg: 0,
      full: 0
    };
  }

  for (
    let d = new Date(startDate);
    d <= end;
    d.setDate(
      d.getDate() + 1
    )
  ) {

    const s =
      statsFor(
        iso(d),
        userId
      );

    sum += s.pct;

    total++;

    if (s.pct === 100) {
      full++;
    }
  }

  return {

    days: total,

    avg:
      total
        ? Math.round(
            sum / total
          )
        : 0,

    full
  };
}

/* =========================================================
   WEIGHT
========================================================= */

function lastWeight(
  userId = activeUserId
) {

  const arr =
    users[userId]?.weights || [];

  return arr.length
    ? Number(
        arr[arr.length - 1].value
      )
    : null;
}

function initialWeight(
  userId = activeUserId
) {

  const arr =
    users[userId]?.weights || [];

  return arr.length
    ? Number(
        arr[0].value
      )
    : null;
}

function lostKg(
  userId = activeUserId
) {

  const a =
    initialWeight(userId);

  const b =
    lastWeight(userId);

  return (
    a != null &&
    b != null
  )
    ? Math.max(
        0,
        a - b
      )
    : 0;
}

function beautyFund(
  userId = activeUserId
) {

  return (
    Math.floor(
      lostKg(userId)
    ) * 1000
  );
}

function habitRate(
  id,
  userId = activeUserId
) {

  const start =
    users[userId]?.startDate;

  if (!start) {
    return 0;
  }

  const startDate =
    new Date(
      start +
      "T00:00:00"
    );

  const end =
    new Date(
      today() +
      "T00:00:00"
    );

  if (end < startDate) {
    return 0;
  }

  let total = 0;
  let done = 0;

  for (
    let d = new Date(startDate);
    d <= end;
    d.setDate(
      d.getDate() + 1
    )
  ) {

    const s =
      iso(d);

    const n =
      dayNumFor(
        userId,
        s
      );

    const hs = [
      ...defaultHabits,

      ...(n >= 1 && n % 2 === 1
        ? [{ id: "yoga" }]
        : [])
    ];

    if (
      hs.some(
        h => h.id === id
      )
    ) {

      total++;

      if (
        users[userId]
          ?.days?.[s]
          ?.checks?.[id]
      ) {
        done++;
      }
    }
  }

  return total
    ? Math.round(
        done /
        total *
        100
      )
    : 0;
}

/* =========================================================
   DAYS SAVE
========================================================= */

async function saveDay(date) {

  const d =
    dayData(date);

  const payload = {

    user_id:
      activeUserId,

    day_date:
      date,

    checks:
      d.checks || {},

    steps:
      d.steps === ""
        ? null
        : Number(d.steps),

    pages:
      d.pages === ""
        ? null
        : Number(d.pages),

    minutes:
      d.minutes === ""
        ? null
        : Number(d.minutes),

    meal:
      d.meal || ""
  };

  const {
    data,
    error
  } = await sb
    .from("days")
    .upsert(
      payload,
      {
        onConflict:
          "user_id,day_date"
      }
    )
    .select()
    .single();

  if (error) {

    console.error(error);

    toast(
      "Ошибка сохранения дня"
    );

    return false;
  }

  users[activeUserId]
    .days[date] = {

      id: data.id,

      checks:
        data.checks || {},

      steps:
        data.steps ?? "",

      pages:
        data.pages ?? "",

      minutes:
        data.minutes ?? "",

      meal:
        data.meal || ""
    };

  return true;
}

async function toggleHabit(
  date,
  id,
  val
) {

  const d =
    ensureDayObject(
      activeUserId,
      date
    );

  if (!d) return;

  d.checks[id] =
    val;

  const ok =
    await saveDay(date);

  if (ok) {
    render();
  }
}

async function setExtra(
  date,
  key,
  val
) {

  const d =
    ensureDayObject(
      activeUserId,
      date
    );

  if (!d) return;

  d[key] = val;

  await saveDay(date);

  render();
}

async function saveMeal() {

  const input =
    document.getElementById("meal");

  if (!input) return;

  const d =
    ensureDayObject(
      activeUserId,
      today()
    );

  if (!d) return;

  d.meal =
    input.value;

  if (
    await saveDay(today())
  ) {

    toast(
      "Питание сохранено 🍽️"
    );
  }
}

/* =========================================================
   NOTES
========================================================= */

async function saveNote() {

  const input =
    document.getElementById("note");

  if (!input) return;

  const text =
    input.value;

  const {
    error
  } = await sb
    .from("notes")
    .upsert(
      {
        user_id:
          activeUserId,

        note_date:
          today(),

        text
      },
      {
        onConflict:
          "user_id,note_date"
      }
    );

  if (error) {

    console.error(error);

    toast(
      "Ошибка сохранения заметки"
    );

    return;
  }

  users[activeUserId]
    .notes[today()] =
    text;

  toast(
    "Заметка сохранена ✨"
  );
}

/* =========================================================
   GOALS
========================================================= */

async function saveGoals() {

  const g =
    user().goals;

  const startDate =
    normalizeStartDate(
      g.start_date
    );

  const {
    data,
    error
  } = await sb
    .from("goals")
    .upsert(
      {
        user_id:
          activeUserId,

        socials:
          g.socials || [],

        alcohol:
          !!g.alcohol,

        wishlist:
          !!g.wishlist,

        vision:
          !!g.vision,

        start_date:
          startDate,

        updated_at:
          new Date().toISOString()
      },
      {
        onConflict:
          "user_id"
      }
    )
    .select("*")
    .single();

  if (error) {

    console.error(
      "GOALS SAVE ERROR:",
      error
    );

    toast(
      "Ошибка сохранения целей"
    );

    return false;
  }

  /*
    Берём дату именно из ответа Supabase.
  */

  const savedDate =
    normalizeStartDate(
      data.start_date
    );

  user().goals = {

    socials:
      Array.isArray(data.socials)
        ? data.socials
        : [],

    alcohol:
      !!data.alcohol,

    wishlist:
      !!data.wishlist,

    vision:
      !!data.vision,

    start_date:
      savedDate
  };

  user().startDate =
    savedDate;

  return true;
}

async function toggleSocial(
  value,
  checked
) {

  const arr =
    user().goals.socials;

  if (
    checked &&
    !arr.includes(value)
  ) {
    arr.push(value);
  }

  if (!checked) {

    const index =
      arr.indexOf(value);

    if (index >= 0) {
      arr.splice(index, 1);
    }
  }

  await saveGoals();

  render();
}

async function toggleGoal(
  key,
  value
) {

  user().goals[key] =
    value;

  await saveGoals();

  render();
}

/* =========================================================
   START DATE
========================================================= */

async function changeStart() {

  if (!activeUserId) {
    toast("Пользователь не выбран");
    return;
  }

  const input =
    document.getElementById(
      "startDate"
    );

  if (!input) {
    toast("Поле даты не найдено");
    return;
  }

  const value =
    normalizeStartDate(
      input.value
    );

  if (!value) {
    toast("Выбери дату");
    return;
  }

  /*
    ВАЖНО:

    Сохраняем дату ТОЛЬКО в goals.
    profiles вообще не используется.
  */

  const {
    data,
    error
  } = await sb
    .from("goals")
    .upsert(
      {
        user_id:
          activeUserId,

        socials:
          user().goals.socials || [],

        alcohol:
          !!user().goals.alcohol,

        wishlist:
          !!user().goals.wishlist,

        vision:
          !!user().goals.vision,

        start_date:
          value,

        updated_at:
          new Date().toISOString()
      },
      {
        onConflict:
          "user_id"
      }
    )
    .select("*")
    .single();

  if (error) {

    console.error(
      "START DATE ERROR:",
      error
    );

    toast(
      "Ошибка сохранения даты: " +
      error.message
    );

    return;
  }

  const savedDate =
    normalizeStartDate(
      data.start_date
    );

  if (!savedDate) {

    toast(
      "Supabase не вернул дату"
    );

    return;
  }

  /*
    Обновляем локальное состояние
    только значением из Supabase.
  */

  user().goals = {

    socials:
      Array.isArray(data.socials)
        ? data.socials
        : [],

    alcohol:
      !!data.alcohol,

    wishlist:
      !!data.wishlist,

    vision:
      !!data.vision,

    start_date:
      savedDate
  };

  user().startDate =
    savedDate;

  render();

  toast(
    "Дата старта сохранена: " +
    fmtDate(savedDate) +
    " ✅"
  );
}

/* =========================================================
   WEIGHT + MEASUREMENTS
========================================================= */

async function saveWeight() {

  const weightInput =
    document.getElementById("w");

  if (!weightInput) return;

  const v =
    parseFloat(
      weightInput.value
    );

  if (!v) {

    toast("Введи вес");

    return;
  }

  const {
    error: weightError
  } = await sb
    .from("weights")
    .insert({

      user_id:
        activeUserId,

      record_date:
        today(),

      value:
        v
    });

  if (weightError) {

    console.error(
      weightError
    );

    toast(
      "Ошибка сохранения веса"
    );

    return;
  }

  const names = [
    "chest",
    "waist",
    "belly",
    "hips"
  ];

  const vals = {};

  names.forEach(
    (name, index) => {

      const input =
        document.getElementById(
          "m" + index
        );

      if (!input) return;

      const value =
        parseFloat(
          input.value
        );

      if (!isNaN(value)) {
        vals[name] =
          value;
      }
    }
  );

  const {
    error: measurementError
  } = await sb
    .from("measurements")
    .insert({

      user_id:
        activeUserId,

      record_date:
        today(),

      chest:
        vals.chest ?? null,

      waist:
        vals.waist ?? null,

      belly:
        vals.belly ?? null,

      hips:
        vals.hips ?? null
    });

  if (measurementError) {

    console.error(
      measurementError
    );

    toast(
      "Вес сохранён, замеры нет"
    );

  } else {

    toast(
      "Вес и замеры сохранены ⚖️"
    );
  }

  await loadAllData();

  closeModal();

  render();
}

/* =========================================================
   REWARDS
========================================================= */

function rewardCount(
  type,
  value,
  userId = activeUserId
) {

  const lost =
    lostKg(userId);

  const streak =
    currentStreak(userId);

  if (type === "kg") {

    return Math.floor(
      lost / value
    );
  }

  if (type === "streak") {

    return Math.floor(
      streak / value
    );
  }

  return 0;
}

function rewardKey(
  type,
  value,
  index
) {

  return `${type}_${value}_${index}`;
}

async function claim(id) {

  const {
    error
  } = await sb
    .from("rewards")
    .upsert(
      {
        user_id:
          activeUserId,

        reward_key:
          id,

        claimed_at:
          new Date().toISOString()
      },
      {
        onConflict:
          "user_id,reward_key"
      }
    );

  if (error) {

    console.error(error);

    toast(
      "Ошибка сохранения награды"
    );

    return;
  }

  user().rewards[id] =
    true;

  render();

  toast(
    "Награда отмечена 🎉"
  );
}

/* =========================================================
   RENDER
========================================================= */

function render() {

  if (!user()) return;

  const profileBtn =
    document.getElementById(
      "profileBtn"
    );

  if (profileBtn) {

    profileBtn.textContent =
      `${user().name} ▾`;
  }

  document
    .querySelectorAll(".view")
    .forEach(
      v =>
        v.classList.remove(
          "active"
        )
    );

  const target =
    document.getElementById(
      "view-" +
      currentView
    );

  if (target) {

    target.classList.add(
      "active"
    );
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
          currentView
        );
      }
    );

  const renderers = {

    today:
      renderToday,

    calendar:
      renderCalendar,

    progress:
      renderProgress,

    rewards:
      renderRewards,

    us:
      renderUs
  };

  if (
    renderers[currentView]
  ) {

    renderers[currentView]();
  }
}

/* =========================================================
   TODAY
========================================================= */

function renderToday() {

  /*
    ТОЛЬКО activeUserId.
  */

  const s =
    statsFor(
      today(),
      activeUserId
    );

  const u =
    user();

  const n =
    dayNum(
      today()
    );

  document.getElementById(
    "view-today"
  ).innerHTML = `

    <div class="hero">

      <div class="hero-row">

        <div>

          <div class="muted">
            ${new Date()
              .toLocaleDateString(
                "ru-RU",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                }
              )}
          </div>

          <div class="big-day">

            ${
              n > 0
                ? "День " + n
                : "До старта"
            }

          </div>

          <div class="muted">

            Старт:
            ${fmtDate(
              u.startDate
            )}

          </div>

        </div>

        <div style="
          text-align:right;
        ">

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
          style="
            width:${s.pct}%
          "
        ></div>

      </div>

      <div class="stats">

        <div class="stat">
          🔥 Серия
          <strong>
            ${currentStreak(
              activeUserId
            )}
          </strong>
        </div>

        <div class="stat">
          📆 Дней
          <strong>
            ${challengeDays(
              activeUserId
            )}
          </strong>
        </div>

        <div class="stat">
          🏆 Лучшая
          <strong>
            ${bestStreak(
              activeUserId
            )}
          </strong>
        </div>

      </div>

    </div>

    <div class="card">

      <div class="row">

        <h2>
          Сегодня
        </h2>

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
              .map(
                h =>
                  habitHtml(
                    h,
                    today()
                  )
              )
              .join("")
      }

    </div>

    <div class="grid">

      <div class="card">

        <h2>
          🍽️ Питание
        </h2>

        <textarea
          id="meal"
          placeholder="Что сегодня ела?"
        >${escapeHtml(
          dayData(today()).meal || ""
        )}</textarea>

        <button
          class="btn"
          style="margin-top:9px"
          onclick="saveMeal()"
        >
          Сохранить питание
        </button>

      </div>

      <div class="card">

        <h2>
          📝 Заметка
        </h2>

        <textarea
          id="note"
          placeholder="Как прошёл день?"
        >${escapeHtml(
          u.notes[today()] || ""
        )}</textarea>

        <button
          class="btn"
          style="margin-top:9px"
          onclick="saveNote()"
        >
          Сохранить заметку
        </button>

      </div>

      <div class="card">

        <h2>
          ⚙️ Настройки
        </h2>

        <p class="muted">

          Дата старта:
          ${fmtDate(
            u.startDate
          )}

        </p>

        <div class="field">

          <label>
            Дата начала
          </label>

          <input
            class="input"
            id="startDate"
            type="date"
            value="${
              u.startDate || ""
            }"
          >

        </div>

        <button
          class="btn secondary"
          onclick="changeStart()"
        >
          Сохранить дату старта
        </button>

      </div>

    </div>
  `;
}

function habitHtml(
  h,
  date
) {

  const d =
    dayData(date);

  const checked =
    !!d.checks[h.id];

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

  if (
    h.id === "entertainment"
  ) {

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
        ${
          checked
            ? "checked"
            : ""
        }
        onchange="
          toggleHabit(
            '${date}',
            '${h.id}',
            this.checked
          )
        "
      >

      <div style="
        flex:1
      ">

        <div class="habit-title">
          ${h.icon}
          ${h.title}
        </div>

        <div class="habit-meta">
          ${h.meta}
        </div>

      </div>

      ${extra}

    </div>
  `;
}

/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

  const y =
    calCursor.getFullYear();

  const m =
    calCursor.getMonth();

  const first =
    new Date(y, m, 1);

  const days =
    new Date(
      y,
      m + 1,
      0
    ).getDate();

  const offset =
    (first.getDay() + 6) % 7;

  let cells = [
    "Пн",
    "Вт",
    "Ср",
    "Чт",
    "Пт",
    "Сб",
    "Вс"
  ]
    .map(
      x =>
        `<div class="weekday">${x}</div>`
    )
    .join("");

  for (
    let i = 0;
    i < offset;
    i++
  ) {

    cells +=
      `<div class="daycell out"></div>`;
  }

  for (
    let d = 1;
    d <= days;
    d++
  ) {

    const date =
      iso(
        new Date(
          y,
          m,
          d
        )
      );

    /*
      ТОЛЬКО текущий пользователь.
    */

    const st =
      eligible(date)
        ? statsFor(
            date,
            activeUserId
          )
        : null;

    let cls =
      "daycell";

    if (
      date === today()
    ) {
      cls += " current";
    }

    if (
      st?.pct === 100
    ) {

      cls += " done";

    } else if (
      st?.pct > 0
    ) {

      cls += " partial";
    }

    cells += `

      <button
        class="${cls}"
        onclick="
          openDay('${date}')
        "
      >

        <div class="daynum">
          ${d}
        </div>

        <div class="daystatus">

          ${
            st
              ? `
                День
                ${dayNum(date)}
                ·
                ${st.pct}%
              `
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

          ${new Date(
            y,
            m,
            1
          ).toLocaleDateString(
            "ru-RU",
            {
              month: "long",
              year: "numeric"
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
        🟢 100% ·
        🟡 частично ·
        ⚪ пусто ·
        🔵 сегодня
      </p>

    </div>
  `;
}

function moveMonth(x) {

  calCursor.setMonth(
    calCursor.getMonth() + x
  );

  renderCalendar();
}

function openDay(date) {

  /*
    Только данные activeUserId.
  */

  const st =
    statsFor(
      date,
      activeUserId
    );

  const d =
    dayData(date);

  openModal(`

    <h2>
      ${fmtDate(date)}
      ${
        dayNum(date) > 0
          ? "· День " + dayNum(date)
          : ""
      }
    </h2>

    <div class="kpi">
      ${st.pct}%
    </div>

    <p class="muted">
      ${st.done}/${st.total}
      выполнено
    </p>

    ${
      habitsFor(date)
        .map(
          h => `

            <div class="habit">

              <span>
                ${
                  d.checks[h.id]
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
          `
        )
        .join("")
    }

    <h3>
      📝 Заметка
    </h3>

    <p>
      ${escapeHtml(
        user().notes[date] ||
        "Нет заметки."
      )}
    </p>

  `);
}

/* =========================================================
   PROGRESS
========================================================= */

function renderProgress() {

  /*
    Только activeUserId.
  */

  const o =
    overall(
      activeUserId
    );

  const a =
    initialWeight(
      activeUserId
    );

  const b =
    lastWeight(
      activeUserId
    );

  const rates =
    defaultHabits
      .map(
        h => {

          const rate =
            habitRate(
              h.id,
              activeUserId
            );

          return `

            <div class="metric-row">

              <div>
                ${h.icon}
                ${h.title}
              </div>

              <div>
                <b>
                  ${rate}%
                </b>
              </div>

              <div class="bar">

                <i
                  style="
                    width:${rate}%
                  "
                ></i>

              </div>

            </div>
          `;
        }
      )
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
          полностью выполненных
          дней из
          ${o.days}
        </p>

      </div>

      <div class="card">

        <div class="muted">
          Серия
        </div>

        <div class="kpi">
          🔥
          ${currentStreak(
            activeUserId
          )}
        </div>

        <p>
          Лучшая:
          ${bestStreak(
            activeUserId
          )}
          дней
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
          a != null &&
          b != null

            ? `
              Результат:
              <b>
                ${(b - a).toFixed(1)}
                кг
              </b>
            `

            : `
              Добавь первую
              запись веса.
            `
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

        ${beautyFund(
          activeUserId
        ).toLocaleString(
          "ru-RU"
        )}
        сом

      </div>

      <p class="muted">
        +1 000 сом
        за каждый полный
        потерянный килограмм.
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
          .map(
            (x, i) => `

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
            `
          )
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

/* =========================================================
   REWARDS
========================================================= */

function renderRewards() {

  /*
    Только награды текущего пользователя.
  */

  const lost =
    lostKg(
      activeUserId
    );

  const w =
    lastWeight(
      activeUserId
    );

  const st =
    currentStreak(
      activeUserId
    );

  let cards = [];

  const repeatDefs = [

    {
      type: "kg",
      value: 5,
      icon: "💆",
      title:
        "Стоматолог или косметолог",
      label:
        "за каждые −5 кг"
    },

    {
      type: "kg",
      value: 10,
      icon: "🍕",
      title: "Читмил",
      label:
        "за каждые −10 кг"
    },

    {
      type: "streak",
      value: 30,
      icon: "🏊‍♀️",
      title:
        "Бассейн / SPA",
      label:
        "за каждые 30 дней без срыва"
    }
  ];

  repeatDefs.forEach(
    r => {

      const count =
        rewardCount(
          r.type,
          r.value,
          activeUserId
        );

      for (
        let i = 1;
        i <= Math.max(
          count,
          1
        );
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
            class="
              card
              reward
              ${
                unlocked
                  ? "unlocked"
                  : "locked"
              }
            "
          >

            <div class="reward-icon">
              ${r.icon}
            </div>

            <div style="flex:1">

              <h3>
                ${r.title}
                ${
                  i > 1
                    ? `№${i}`
                    : ""
                }
              </h3>

              <div class="muted">

                ${r.label}

                · порог

                ${r.value * i}

                ${
                  r.type === "kg"
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
              unlocked &&
              !claimed

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
    }
  );

  [
    {
      id: "75",
      icon: "💋",
      title: "Сделать губы",
      rule: "Достичь 75 кг",
      value: 75
    },

    {
      id: "65",
      icon: "📸",
      title:
        "Профессиональная фотосессия",
      rule:
        "Достичь 65 кг",
      value: 65
    },

    {
      id: "60",
      icon: "✈️🛍️",
      title:
        "Путешествие + шопинг",
      rule:
        "Достичь 60 кг",
      value: 60
    }
  ].forEach(
    r => {

      const unlocked =
        w != null &&
        w <= r.value;

      const claimed =
        !!user().rewards[r.id];

      cards.push(`

        <div
          class="
            card
            reward
            ${
              unlocked
                ? "unlocked"
                : "locked"
            }
          "
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
            unlocked &&
            !claimed

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
    }
  );

  document.getElementById(
    "view-rewards"
  ).innerHTML = `

    <div class="hero">

      <div class="muted">
        💄 Фонд красоты
      </div>

      <div class="kpi">

        ${beautyFund(
          activeUserId
        ).toLocaleString(
          "ru-RU"
        )}

        сом

      </div>

      <p class="muted">

        Потеряно:
        ${lost.toFixed(1)} кг

        · текущая серия:

        🔥 ${st} дней

      </p>

    </div>

    <h2 style="
      margin:20px 0 12px
    ">
      🏆 Награды
    </h2>

    ${cards.join("")}
  `;
}

/* =========================================================
   US
========================================================= */

function renderUs() {

  /*
    ВОТ ЗДЕСЬ специально показываются
    данные ВСЕХ пользователей.

    Это единственная общая страница.
  */

  const cards =
    allUsers()
      .map(u => {

        const s =
          statsFor(
            today(),
            u.id
          );

        const st =
          currentStreak(
            u.id
          );

        const w =
          lastWeight(
            u.id
          );

        const a =
          initialWeight(
            u.id
          );

        const todayData =
          u.days[today()]
          || {
            checks: {},
            steps: "",
            pages: "",
            minutes: "",
            meal: ""
          };

        const note =
          u.notes[today()] ||
          "";

        const measures =
          u.measurements.length
            ? u.measurements[
                u.measurements.length - 1
              ]
            : null;

        const habits =
          habitsForUser(
            u.id,
            today()
          )
            .map(
              h => `

                <div
                  class="habit"
                  style="
                    padding:8px 0
                  "
                >

                  <span>

                    ${
                      todayData
                        .checks?.[h.id]
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
              `
            )
            .join("");

        return `

          <div class="card">

            <div class="row">

              <h2>
                ${escapeHtml(
                  u.name
                )}
              </h2>

              <span class="tag">
                Общий доступ
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

                  ${beautyFund(
                    u.id
                  ).toLocaleString(
                    "ru-RU"
                  )}

                  сом

                </strong>

              </div>

            </div>

            <details
              style="
                margin-top:14px
              "
            >

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

            <details
              style="
                margin-top:12px
              "
            >

              <summary>
                <b>
                  🍽️ Питание
                </b>
              </summary>

              <p>

                ${escapeHtml(
                  todayData.meal ||
                  "Сегодня ничего не записано."
                )}

              </p>

            </details>

            <details
              style="
                margin-top:12px
              "
            >

              <summary>
                <b>
                  📝 Заметка за сегодня
                </b>
              </summary>

              <p>

                ${escapeHtml(
                  note ||
                  "Сегодня заметки нет."
                )}

              </p>

            </details>

            <details
              style="
                margin-top:12px
              "
            >

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
                      ${
                        measures.chest ??
                        "—"
                      } см ·

                      Талия:
                      ${
                        measures.waist ??
                        "—"
                      } см ·

                      Живот:
                      ${
                        measures.belly ??
                        "—"
                      } см ·

                      Бёдра:
                      ${
                        measures.hips ??
                        "—"
                      } см

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

  /*
    Цели показываем для текущего пользователя,
    потому что это его личные цели.
  */

  const currentGoals =
    user().goals;

  document.getElementById(
    "view-us"
  ).innerHTML = `

    <div class="hero">

      <h2>
        👯‍♀️ Мы вдвоём
      </h2>

      <p class="muted">

        Здесь отображаются
        общие данные:
        вес, замеры, питание,
        заметки, привычки,
        серии и награды.

      </p>

    </div>

    ${cards}

    <div class="card">

      <h2>
        🎯 Мои цели
      </h2>

      <div class="field">

        <label>
          Социальные сети
          до Нового года
        </label>

        ${
          [
            "Instagram",
            "TikTok",
            "Threads",
            "Другое"
          ]
            .map(
              x => `

                <label
                  style="
                    display:block;
                    margin:7px 0
                  "
                >

                  <input
                    type="checkbox"

                    ${
                      currentGoals
                        .socials
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
              `
            )
            .join("")
        }

      </div>

      <label class="habit">

        <input
          type="checkbox"

          ${
            currentGoals.alcohol
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
            currentGoals.vision
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
            currentGoals.wishlist
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

      <div
        class="field"
        style="margin-top:18px"
      >

        <label>
          📅 Дата старта челленджа
        </label>

        <input
          class="input"
          id="startDate"
          type="date"
          value="${
            currentGoals.start_date || ""
          }"
        >

        <button
          class="btn secondary"
          style="margin-top:9px"
          onclick="changeStart()"
        >
          Сохранить дату старта
        </button>

        <p class="muted">

          Текущая дата:
          ${
            fmtDate(
              currentGoals.start_date
            )
          }

        </p>

      </div>

    </div>
  `;
}

/* =========================================================
   PROFILE
========================================================= */

function openProfile() {

  openModal(`

    <h2>
      👤 Профиль
    </h2>

    <p>
      Выбери пользователя.
    </p>

    ${
      allUsers()
        .map(
          u => `

            <button
              class="
                btn
                ${
                  u.id === activeUserId
                    ? ""
                    : "secondary"
                }
              "
              style="
                width:100%;
                margin:6px 0
              "
              onclick="
                switchUser(
                  '${u.id}'
                )
              "
            >

              ${escapeHtml(
                u.name
              )}

            </button>
          `
        )
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

function switchUser(id) {

  if (!users[id]) {
    return;
  }

  /*
    При переключении пользователя
    дата берётся из goals,
    потому что users.startDate
    уже был загружен из goals.start_date.
  */

  activeUserId =
    id;

  users[id].startDate =
    normalizeStartDate(
      users[id]
        ?.goals
        ?.start_date
    );

  closeModal();

  render();
}

/* =========================================================
   MODAL
========================================================= */

function openModal(html) {

  const content =
    document.getElementById(
      "modalContent"
    );

  const modal =
    document.getElementById(
      "modal"
    );

  if (!content || !modal) {
    return;
  }

  content.innerHTML =
    html;

  modal.classList.remove(
    "hidden"
  );
}

function closeModal() {

  const modal =
    document.getElementById(
      "modal"
    );

  if (modal) {

    modal.classList.add(
      "hidden"
    );
  }
}

/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  const modalClose =
    document.getElementById(
      "modalClose"
    );

  if (modalClose) {

    modalClose.onclick =
      closeModal;
  }

  const modal =
    document.getElementById(
      "modal"
    );

  if (modal) {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target.id ===
          "modal"
        ) {

          closeModal();
        }
      }
    );
  }

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(button => {

      button.onclick =
        () => {

          currentView =
            button.dataset.view;

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

/* =========================================================
   START
========================================================= */

(async function () {

  setupEvents();

  await init();

})();
