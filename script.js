const STORAGE_KEY = "questboard-users";
const SESSION_KEY = "questboard-active-user";

const elements = {
  loginForm: document.querySelector("#login-form"),
  usernameInput: document.querySelector("#username-input"),
  activeUser: document.querySelector("#active-user"),
  activeUserText: document.querySelector("#active-user-text"),
  logoutBtn: document.querySelector("#logout-btn"),
  questForm: document.querySelector("#quest-form"),
  questTitle: document.querySelector("#quest-title"),
  questDetail: document.querySelector("#quest-detail"),
  questPriority: document.querySelector("#quest-priority"),
  questDue: document.querySelector("#quest-due"),
  questFilter: document.querySelector("#quest-filter"),
  questList: document.querySelector("#quest-list"),
  categoryList: document.querySelector("#category-list"),
  suggestionList: document.querySelector("#suggestion-list"),
  xpValue: document.querySelector("#xp-value"),
  levelValue: document.querySelector("#level-value"),
  completedValue: document.querySelector("#completed-value"),
  activeQuestsValue: document.querySelector("#active-quests-value"),
  streakValue: document.querySelector("#streak-value"),
  highPriorityValue: document.querySelector("#high-priority-value"),
  xpBar: document.querySelector("#xp-bar"),
  mapStatus: document.querySelector("#map-status"),
  mapCanvas: document.querySelector("#map-canvas"),
};

const users = loadUsers();
let currentUser = localStorage.getItem(SESSION_KEY) || "";
const map = {
  ctx: elements.mapCanvas.getContext("2d"),
  heroX: 24,
  heroY: 24,
  targetX: 24,
  targetY: 24,
  mode: "camp",
  tick: 0,
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function createUserState(username) {
  return {
    username,
    xp: 0,
    completedCount: 0,
    quests: [],
    categories: {},
    completionLog: [],
    suggestions: [
      "Break your biggest quest into 2 subtasks.",
      "Schedule a 25-minute focus sprint.",
      "Archive one completed quest for clarity.",
    ],
  };
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getLevel(xp) {
  return Math.floor(xp / 120) + 1;
}

function xpIntoLevel(xp) {
  return xp % 120;
}

function categorizeQuest(title, detail) {
  const combined = `${title} ${detail}`.toLowerCase();
  if (/(code|bug|deploy|api|app|test)/.test(combined)) return "Engineering";
  if (/(write|blog|post|design|video|content)/.test(combined)) return "Creative";
  if (/(client|meeting|email|crm|sales|support)/.test(combined)) return "Operations";
  if (/(gym|health|sleep|run|meal)/.test(combined)) return "Personal";
  return "General";
}

function suggestSubtasks(quest) {
  return [
    `Clarify the first concrete step for "${quest.title}".`,
    "Estimate time needed and choose a start block.",
    "Define done criteria for this quest.",
  ];
}

function buildNpcSuggestions(user) {
  const open = user.quests.filter((quest) => !quest.completed);
  const overdue = open.filter((quest) => quest.dueDate && quest.dueDate < todayISO());
  const fresh = [];

  if (overdue.length > 0) {
    fresh.push(`You have ${overdue.length} overdue quest(s). Tackle one first for momentum.`);
  }

  const highPriority = open.find((quest) => quest.priority === "high");
  if (highPriority) {
    fresh.push(`High-priority focus: "${highPriority.title}". Protect a deep-work block for it.`);
  }

  if (open.length === 0) {
    fresh.push("Add a new main quest to keep momentum.");
  } else {
    const first = open[0];
    fresh.push(`Subquests for "${first.title}": ${suggestSubtasks(first).join(" ")}`);
    fresh.push(`Focus category: ${first.category}. Complete one quest there for bonus confidence.`);
  }
  if (open.length > 3) {
    fresh.push("You have many active quests. Complete one quick-win quest for easy XP.");
  }

  return [...fresh, ...user.suggestions].slice(0, 6);
}

function ensureUser() {
  if (!currentUser) return null;
  if (!users[currentUser]) {
    users[currentUser] = createUserState(currentUser);
    saveUsers();
  }
  return users[currentUser];
}

function calculateXpReward(detail, priority) {
  const detailBoost = Math.min(detail.length, 120) / 6;
  const priorityBonus = { low: 0, medium: 10, high: 20 }[priority] || 0;
  return 30 + detailBoost + priorityBonus;
}

function addQuest(title, detail, priority, dueDate) {
  const user = ensureUser();
  if (!user) return;
  const category = categorizeQuest(title, detail);
  const quest = {
    id: crypto.randomUUID(),
    title,
    detail,
    category,
    priority,
    dueDate,
    completed: false,
    xpReward: calculateXpReward(detail, priority),
    createdAt: Date.now(),
  };
  user.quests.unshift(quest);
  user.categories[category] = (user.categories[category] || 0) + 1;
  user.suggestions = buildNpcSuggestions(user);
  saveUsers();
  render();
}

function updateCompletionLog(user, completed) {
  if (!completed) return;
  const today = todayISO();
  if (!user.completionLog.includes(today)) {
    user.completionLog.push(today);
  }
}

function calculateStreak(user) {
  const uniqueDays = [...new Set(user.completionLog)].sort();
  if (uniqueDays.length === 0) return 0;

  let streak = 0;
  let cursor = new Date(todayISO());

  while (true) {
    const cursorISO = cursor.toISOString().split("T")[0];
    if (uniqueDays.includes(cursorISO)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

function toggleQuest(questId) {
  const user = ensureUser();
  if (!user) return;
  const quest = user.quests.find((item) => item.id === questId);
  if (!quest) return;
  const wasCompleted = quest.completed;
  quest.completed = !quest.completed;
  if (!wasCompleted && quest.completed) {
    user.xp += Math.floor(quest.xpReward);
    user.completedCount += 1;
    updateCompletionLog(user, true);
    map.mode = "battle";
  } else if (wasCompleted && !quest.completed) {
    user.xp = Math.max(0, user.xp - Math.floor(quest.xpReward));
    user.completedCount = Math.max(0, user.completedCount - 1);
  }
  user.suggestions = buildNpcSuggestions(user);
  saveUsers();
  render();
}

function deleteQuest(questId) {
  const user = ensureUser();
  if (!user) return;
  const idx = user.quests.findIndex((quest) => quest.id === questId);
  if (idx === -1) return;
  const [removed] = user.quests.splice(idx, 1);

  if (removed.completed) {
    user.xp = Math.max(0, user.xp - Math.floor(removed.xpReward));
    user.completedCount = Math.max(0, user.completedCount - 1);
  }

  user.categories = user.quests.reduce((acc, quest) => {
    acc[quest.category] = (acc[quest.category] || 0) + 1;
    return acc;
  }, {});

  user.suggestions = buildNpcSuggestions(user);
  saveUsers();
  render();
}

function renderAuth() {
  const user = ensureUser();
  if (!user) {
    elements.activeUser.classList.add("hidden");
    return;
  }
  elements.activeUser.classList.remove("hidden");
  elements.activeUserText.textContent = `Hero: ${user.username}`;
}

function renderStats(user) {
  const level = getLevel(user.xp);
  const inLevel = xpIntoLevel(user.xp);
  const open = user.quests.filter((quest) => !quest.completed);
  const openCount = open.length;
  const highPriorityCount = open.filter((quest) => quest.priority === "high").length;
  const streak = calculateStreak(user);

  elements.levelValue.textContent = String(level);
  elements.xpValue.textContent = String(user.xp);
  elements.completedValue.textContent = String(user.completedCount);
  elements.activeQuestsValue.textContent = String(openCount);
  elements.streakValue.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
  elements.highPriorityValue.textContent = String(highPriorityCount);
  elements.xpBar.style.width = `${(inLevel / 120) * 100}%`;

  map.mode = user.completedCount > 0 ? "village" : "camp";
}

function formatDate(dateText) {
  if (!dateText) return "No due date";
  const dt = new Date(`${dateText}T00:00:00`);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function matchesFilter(quest, filterValue) {
  if (filterValue === "active") return !quest.completed;
  if (filterValue === "completed") return quest.completed;
  if (filterValue === "overdue") return !quest.completed && quest.dueDate && quest.dueDate < todayISO();
  return true;
}

function renderQuests(user) {
  elements.questList.innerHTML = "";
  const filterValue = elements.questFilter.value;
  const filtered = user.quests.filter((quest) => matchesFilter(quest, filterValue));

  if (filtered.length === 0) {
    elements.questList.innerHTML = `<li class='quest-item'>No quests for <strong>${filterValue}</strong>. Try another filter.</li>`;
    return;
  }

  filtered.forEach((quest) => {
    const overdue = !quest.completed && quest.dueDate && quest.dueDate < todayISO();
    const li = document.createElement("li");
    li.className = "quest-item";
    li.innerHTML = `
      <div class="quest-item__top">
        <label>
          <input type="checkbox" data-quest-id="${quest.id}" ${quest.completed ? "checked" : ""} />
          <strong>${quest.title}</strong>
        </label>
        <div class="quest-item__action">
          <span>${Math.floor(quest.xpReward)} XP</span>
          <button class="danger" data-delete-id="${quest.id}" type="button">Delete</button>
        </div>
      </div>
      <small>${quest.detail || "No extra detail."}</small>
      <div class="quest-item__meta">
        <span class="badge">${quest.category}</span>
        <span class="badge ${quest.priority === "high" ? "badge--high" : ""}">${quest.priority} priority</span>
        <span class="badge">Due: ${formatDate(quest.dueDate)}</span>
        ${overdue ? '<span class="badge badge--overdue">Overdue</span>' : ""}
        <span class="badge">${quest.completed ? "Completed" : "Active"}</span>
      </div>
    `;
    elements.questList.append(li);
  });
}

function renderCategories(user) {
  elements.categoryList.innerHTML = "";
  const categories = Object.entries(user.categories);
  if (categories.length === 0) {
    elements.categoryList.innerHTML = "<p>Categories auto-populate as quests are added.</p>";
    return;
  }
  categories
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.innerHTML = `<strong>${name}</strong><p>${count} quests assigned</p>`;
      elements.categoryList.append(card);
    });
}

function renderSuggestions(user) {
  elements.suggestionList.innerHTML = "";
  user.suggestions.forEach((text) => {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.textContent = `🧙 ${text}`;
    elements.suggestionList.append(li);
  });
}

function render() {
  const user = ensureUser();
  renderAuth();
  if (!user) return;
  renderStats(user);
  renderQuests(user);
  renderCategories(user);
  renderSuggestions(user);
}

function login(event) {
  event.preventDefault();
  const username = elements.usernameInput.value.trim().toLowerCase();
  if (!username) return;
  currentUser = username;
  localStorage.setItem(SESSION_KEY, currentUser);
  if (!users[currentUser]) users[currentUser] = createUserState(currentUser);
  saveUsers();
  elements.usernameInput.value = "";
  render();
}

function logout() {
  currentUser = "";
  localStorage.removeItem(SESSION_KEY);
  elements.activeUser.classList.add("hidden");
  elements.questList.innerHTML = "<li class='quest-item'>Log in to see quests.</li>";
  elements.categoryList.innerHTML = "<p>Log in to view categories.</p>";
  elements.suggestionList.innerHTML = "<li class='suggestion-item'>Log in for AI companion guidance.</li>";
  elements.levelValue.textContent = "1";
  elements.xpValue.textContent = "0";
  elements.completedValue.textContent = "0";
  elements.activeQuestsValue.textContent = "0";
  elements.streakValue.textContent = "0";
  elements.highPriorityValue.textContent = "0";
  elements.xpBar.style.width = "0%";
}

function onQuestSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;
  const title = elements.questTitle.value.trim();
  const detail = elements.questDetail.value.trim();
  const priority = elements.questPriority.value;
  const dueDate = elements.questDue.value;
  if (!title) return;
  addQuest(title, detail, priority, dueDate);
  elements.questTitle.value = "";
  elements.questDetail.value = "";
  elements.questPriority.value = "medium";
  elements.questDue.value = "";
}

function onQuestListChange(event) {
  const input = event.target;
  if (!input.matches("input[data-quest-id]")) return;
  toggleQuest(input.dataset.questId);
}

function onQuestListClick(event) {
  const button = event.target.closest("button[data-delete-id]");
  if (!button) return;
  deleteQuest(button.dataset.deleteId);
}

function drawTile(x, y, color) {
  map.ctx.fillStyle = color;
  map.ctx.fillRect(x, y, 20, 20);
}

function drawHero(x, y, frame) {
  const ctx = map.ctx;
  ctx.fillStyle = "#e9f0ff";
  ctx.fillRect(x + 6, y + 3, 8, 8);
  ctx.fillStyle = "#2f6fff";
  ctx.fillRect(x + 5, y + 11, 10, 7);
  ctx.fillStyle = frame % 20 < 10 ? "#f8c85b" : "#ff8da8";
  ctx.fillRect(x + 8, y + 0, 4, 3);
}

function renderMapScene() {
  const ctx = map.ctx;
  const { width, height } = elements.mapCanvas;
  ctx.clearRect(0, 0, width, height);

  for (let y = 0; y < height; y += 20) {
    for (let x = 0; x < width; x += 20) {
      const grass = (x / 20 + y / 20) % 2 === 0 ? "#2d5a3d" : "#336648";
      drawTile(x, y, grass);
    }
  }

  for (let i = 0; i < 4; i += 1) {
    drawTile(300 + i * 20, 40, "#8f6a42");
    drawTile(300 + i * 20, 60, "#b08453");
  }
  drawTile(70, 170, "#7d2f34");
  drawTile(90, 170, "#a1373f");

  const dx = map.targetX - map.heroX;
  const dy = map.targetY - map.heroY;
  map.heroX += Math.sign(dx) * Math.min(Math.abs(dx), 1.2);
  map.heroY += Math.sign(dy) * Math.min(Math.abs(dy), 1.2);

  drawHero(map.heroX, map.heroY, map.tick);

  if (map.mode === "battle") {
    ctx.fillStyle = "#ff5f6d";
    ctx.fillRect(95, 174, 6, 6);
    elements.mapStatus.textContent = "The hero is attacking enemies after your completed quests!";
    map.targetX = 80;
    map.targetY = 165;
    map.mode = "village";
  } else if (map.mode === "village") {
    elements.mapStatus.textContent = "The hero marches toward the village as your XP grows.";
    map.targetX = 320;
    map.targetY = 40;
  } else {
    elements.mapStatus.textContent = "The hero waits at camp for your next quest.";
    map.targetX = 24;
    map.targetY = 24;
  }

  map.tick += 1;
  requestAnimationFrame(renderMapScene);
}

function init() {
  elements.loginForm.addEventListener("submit", login);
  elements.logoutBtn.addEventListener("click", logout);
  elements.questForm.addEventListener("submit", onQuestSubmit);
  elements.questFilter.addEventListener("change", render);
  elements.questList.addEventListener("change", onQuestListChange);
  elements.questList.addEventListener("click", onQuestListClick);

  if (!currentUser) logout();
  else render();

  renderMapScene();
}

init();
