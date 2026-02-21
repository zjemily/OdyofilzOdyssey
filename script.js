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
  questList: document.querySelector("#quest-list"),
  categoryList: document.querySelector("#category-list"),
  suggestionList: document.querySelector("#suggestion-list"),
  xpValue: document.querySelector("#xp-value"),
  levelValue: document.querySelector("#level-value"),
  completedValue: document.querySelector("#completed-value"),
  activeQuestsValue: document.querySelector("#active-quests-value"),
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

function createUserState(username) {
  return {
    username,
    xp: 0,
    completedCount: 0,
    quests: [],
    categories: {},
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
    `Estimate time needed and choose a start block.`,
    `Define done criteria for this quest.`,
  ];
}

function buildNpcSuggestions(user) {
  const open = user.quests.filter((quest) => !quest.completed);
  const fresh = [];
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

function addQuest(title, detail) {
  const user = ensureUser();
  if (!user) return;
  const category = categorizeQuest(title, detail);
  const quest = {
    id: crypto.randomUUID(),
    title,
    detail,
    category,
    completed: false,
    xpReward: 30 + Math.min(detail.length, 120) / 6,
    createdAt: Date.now(),
  };
  user.quests.unshift(quest);
  user.categories[category] = (user.categories[category] || 0) + 1;
  user.suggestions = buildNpcSuggestions(user);
  saveUsers();
  render();
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
    map.mode = "battle";
  } else if (wasCompleted && !quest.completed) {
    user.xp = Math.max(0, user.xp - Math.floor(quest.xpReward));
    user.completedCount = Math.max(0, user.completedCount - 1);
  }
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
  const openCount = user.quests.filter((quest) => !quest.completed).length;

  elements.levelValue.textContent = String(level);
  elements.xpValue.textContent = String(user.xp);
  elements.completedValue.textContent = String(user.completedCount);
  elements.activeQuestsValue.textContent = String(openCount);
  elements.xpBar.style.width = `${(inLevel / 120) * 100}%`;

  map.mode = user.completedCount > 0 ? "village" : "camp";
}

function renderQuests(user) {
  elements.questList.innerHTML = "";
  if (user.quests.length === 0) {
    elements.questList.innerHTML = "<li class='quest-item'>No quests yet. Start your first adventure.</li>";
    return;
  }
  user.quests.forEach((quest) => {
    const li = document.createElement("li");
    li.className = "quest-item";
    li.innerHTML = `
      <div class="quest-item__top">
        <label>
          <input type="checkbox" data-quest-id="${quest.id}" ${quest.completed ? "checked" : ""} />
          <strong>${quest.title}</strong>
        </label>
        <span>${Math.floor(quest.xpReward)} XP</span>
      </div>
      <small>${quest.detail || "No extra detail."}</small>
      <div class="quest-item__meta">
        <span class="badge">${quest.category}</span>
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
  elements.xpBar.style.width = "0%";
}

function onQuestSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;
  const title = elements.questTitle.value.trim();
  const detail = elements.questDetail.value.trim();
  if (!title) return;
  addQuest(title, detail);
  elements.questTitle.value = "";
  elements.questDetail.value = "";
}

function onQuestListChange(event) {
  const input = event.target;
  if (!input.matches("input[data-quest-id]")) return;
  toggleQuest(input.dataset.questId);
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
  elements.questList.addEventListener("change", onQuestListChange);

  if (!currentUser) logout();
  else render();

  renderMapScene();
}

init();
