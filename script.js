const STORAGE_KEY = "philosophie-state";

const defaultState = {
  projects: [
    {
      id: crypto.randomUUID(),
      name: "Lancement infolettre Rose Quartz",
      description: "Planifier le contenu, préparer l'inscription, automatiser la diffusion.",
      tasks: [
        {
          id: crypto.randomUUID(),
          title: "Écrire les 3 premiers sujets",
          completed: false,
          subtasks: [
            { id: crypto.randomUUID(), title: "Lister les angles possibles", completed: true },
            { id: crypto.randomUUID(), title: "Valider le ton de marque", completed: false },
          ],
        },
      ],
    },
  ],
  suggestions: [
    "Créer un mini-podcast mensuel à partir des notes internes",
    "Optimiser le support client avec FAQ, réponses rapides et suivi",
    "Mettre en place un tableau de bord des ventes hebdo",
  ],
  driveConfig: {
    clientId: "",
    apiKey: "",
  },
};

let state = loadState();
let driveTokenClient = null;
let driveAccessToken = "";

const elements = {
  ctaProject: document.querySelector("#cta-project"),
  ctaSuggestions: document.querySelector("#cta-suggestions"),
  projectsSection: document.querySelector("#projects-section"),
  suggestionsSection: document.querySelector("#suggestions-section"),
  projectSelect: document.querySelector("#project-select"),
  projectList: document.querySelector("#project-list"),
  projectForm: document.querySelector("#project-form"),
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-title"),
  projectNameInput: document.querySelector("#project-name"),
  projectDescriptionInput: document.querySelector("#project-description"),
  suggestionList: document.querySelector("#suggestion-list"),
  suggestionInput: document.querySelector("#suggestion-input"),
  addSuggestionBtn: document.querySelector("#add-suggestion"),
  driveClientId: document.querySelector("#drive-client-id"),
  driveApiKey: document.querySelector("#drive-api-key"),
  driveStatus: document.querySelector("#drive-status"),
  connectDrive: document.querySelector("#connect-drive"),
  saveDrive: document.querySelector("#save-drive"),
  exportLocal: document.querySelector("#export-local"),
  importLocal: document.querySelector("#import-local"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderProjects() {
  elements.projectSelect.innerHTML = "";
  state.projects.forEach((project, index) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = `${project.name} (${project.tasks.length} tâches)`;
    if (index === 0) option.selected = true;
    elements.projectSelect.append(option);
  });

  elements.projectList.innerHTML = "";
  state.projects.forEach((project) => {
    const article = document.createElement("article");
    article.className = "project-card";

    const header = document.createElement("div");
    header.className = "project-card__header";
    header.innerHTML = `
      <div>
        <h3>${project.name}</h3>
        <p>${project.description}</p>
      </div>
      <span class="pill">${project.tasks.length} tâches</span>
    `;

    const taskList = document.createElement("ul");
    taskList.className = "task-list";

    project.tasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "task-item";
      item.innerHTML = `
        <label>
          <input type="checkbox" ${task.completed ? "checked" : ""} data-task-id="${task.id}" data-project-id="${project.id}" />
          <span>${task.title}</span>
        </label>
        <ul class="subtask-list">
          ${task.subtasks
            .map(
              (sub) => `
                <li>
                  <label>
                    <input type="checkbox" ${sub.completed ? "checked" : ""} data-subtask-id="${sub.id}" data-task-id="${task.id}" data-project-id="${project.id}" />
                    <span>${sub.title}</span>
                  </label>
                </li>
              `
            )
            .join("")}
        </ul>
      `;
      taskList.append(item);
    });

    article.append(header, taskList);
    elements.projectList.append(article);
  });
}

function renderSuggestions() {
  elements.suggestionList.innerHTML = "";
  state.suggestions.forEach((suggestion, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>✨ ${suggestion}</span>
      <button class="ghost" data-suggestion-index="${index}">Ajouter</button>
    `;
    elements.suggestionList.append(li);
  });
}

function updateDriveInputs() {
  elements.driveClientId.value = state.driveConfig.clientId;
  elements.driveApiKey.value = state.driveConfig.apiKey;
}

function ensureLocalhostForDrive() {
  if (window.location.protocol === "file:") {
    elements.driveStatus.textContent =
      "Google Drive nécessite http://localhost. Lancez un petit serveur local puis rechargez.";
    return false;
  }
  return true;
}

function scrollToSection(section) {
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addProject(name, description) {
  state.projects.unshift({
    id: crypto.randomUUID(),
    name,
    description,
    tasks: [],
  });
  saveState();
  renderProjects();
}

function addTaskToProject(projectId, title) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.tasks.unshift({
    id: crypto.randomUUID(),
    title,
    completed: false,
    subtasks: generateSubtasks(title),
  });
  saveState();
  renderProjects();
}

function generateSubtasks(title) {
  const templates = [
    `Définir l'objectif pour "${title}"`,
    `Créer une checklist rapide pour "${title}"`,
    `Préparer un brouillon pour "${title}"`,
  ];
  return templates.map((text) => ({
    id: crypto.randomUUID(),
    title: text,
    completed: false,
  }));
}

function toggleTask(projectId, taskId, completed) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = completed;
  if (completed) {
    task.subtasks = task.subtasks.map((sub) => ({ ...sub, completed: true }));
  }
  saveState();
  renderProjects();
}

function toggleSubtask(projectId, taskId, subtaskId, completed) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const subtask = task.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) return;
  subtask.completed = completed;
  task.completed = task.subtasks.every((item) => item.completed);
  saveState();
  renderProjects();
}

function addSuggestion(text) {
  if (!text.trim()) return;
  state.suggestions.unshift(text.trim());
  saveState();
  renderSuggestions();
}

function addSuggestionToProject(index) {
  const projectId = elements.projectSelect.value;
  if (!projectId) return;
  const suggestion = state.suggestions[index];
  if (!suggestion) return;
  addTaskToProject(projectId, suggestion);
}

function handleProjectForm(event) {
  event.preventDefault();
  const name = elements.projectNameInput.value.trim();
  const description = elements.projectDescriptionInput.value.trim();
  if (!name) return;
  addProject(name, description || "Projet inspiré par PhiloSophie");
  elements.projectNameInput.value = "";
  elements.projectDescriptionInput.value = "";
}

function handleTaskForm(event) {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) return;
  addTaskToProject(elements.projectSelect.value, title);
  elements.taskInput.value = "";
}

function handleProjectClick(event) {
  const target = event.target;
  if (target.matches("input[data-task-id]")) {
    toggleTask(target.dataset.projectId, target.dataset.taskId, target.checked);
  }
  if (target.matches("input[data-subtask-id]")) {
    toggleSubtask(
      target.dataset.projectId,
      target.dataset.taskId,
      target.dataset.subtaskId,
      target.checked
    );
  }
}

function handleSuggestionClick(event) {
  const button = event.target.closest("button[data-suggestion-index]");
  if (!button) return;
  addSuggestionToProject(Number(button.dataset.suggestionIndex));
}

function handleAddSuggestion() {
  addSuggestion(elements.suggestionInput.value);
  elements.suggestionInput.value = "";
}

function updateDriveConfig() {
  state.driveConfig.clientId = elements.driveClientId.value.trim();
  state.driveConfig.apiKey = elements.driveApiKey.value.trim();
  saveState();
}

async function loadDriveSdk() {
  if (window.gapi) return;
  await new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = resolve;
    document.body.append(script);
  });
}

async function loadIdentitySdk() {
  if (window.google?.accounts?.oauth2) return;
  await new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = resolve;
    document.body.append(script);
  });
}

async function initDriveClient() {
  if (!ensureLocalhostForDrive()) return false;
  const { clientId, apiKey } = state.driveConfig;
  if (!clientId || !apiKey) {
    elements.driveStatus.textContent = "Ajoutez votre client ID et votre clé API pour connecter Google Drive.";
    return false;
  }

  await loadDriveSdk();
  await loadIdentitySdk();

  await new Promise((resolve) => window.gapi.load("client", resolve));
  await window.gapi.client.init({
    apiKey,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });

  driveTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (tokenResponse) => {
      driveAccessToken = tokenResponse.access_token;
      elements.driveStatus.textContent = "Connecté à Google Drive ✅";
    },
  });

  elements.driveStatus.textContent = "Prêt à se connecter à Google Drive.";
  return true;
}

async function connectDrive() {
  if (!ensureLocalhostForDrive()) return;
  updateDriveConfig();
  const ready = await initDriveClient();
  if (!ready || !driveTokenClient) return;
  driveTokenClient.requestAccessToken({ prompt: "consent" });
}

async function saveToDrive() {
  if (!ensureLocalhostForDrive()) return;
  if (!driveAccessToken) {
    elements.driveStatus.textContent = "Connectez-vous avant de sauvegarder.";
    return;
  }

  const fileContent = JSON.stringify(state, null, 2);
  const metadata = {
    name: `philosophie-${new Date().toISOString().slice(0, 10)}.json`,
    mimeType: "application/json",
  };
  const boundary = "philo-boundary";
  const multipartRequestBody =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    fileContent +
    `\r\n--${boundary}--`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${driveAccessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (response.ok) {
    elements.driveStatus.textContent = "Sauvegarde envoyée à Google Drive ✅";
  } else {
    elements.driveStatus.textContent = "Échec de la sauvegarde. Vérifiez les autorisations.";
  }
}

function exportLocal() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `philosophie-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importLocal(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.projects || !parsed.suggestions) {
        throw new Error("Format invalide");
      }
      state = { ...state, ...parsed };
      saveState();
      renderProjects();
      renderSuggestions();
      updateDriveInputs();
      elements.driveStatus.textContent = "Données importées ✅";
    } catch {
      elements.driveStatus.textContent = "Importation échouée. Vérifiez le fichier JSON.";
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function init() {
  renderProjects();
  renderSuggestions();
  updateDriveInputs();
  elements.ctaProject.addEventListener("click", () => scrollToSection(elements.projectsSection));
  elements.ctaSuggestions.addEventListener("click", () => scrollToSection(elements.suggestionsSection));
  elements.projectForm.addEventListener("submit", handleProjectForm);
  elements.taskForm.addEventListener("submit", handleTaskForm);
  elements.projectList.addEventListener("change", handleProjectClick);
  elements.suggestionList.addEventListener("click", handleSuggestionClick);
  elements.addSuggestionBtn.addEventListener("click", handleAddSuggestion);
  elements.driveClientId.addEventListener("blur", updateDriveConfig);
  elements.driveApiKey.addEventListener("blur", updateDriveConfig);
  elements.connectDrive.addEventListener("click", connectDrive);
  elements.saveDrive.addEventListener("click", saveToDrive);
  elements.exportLocal.addEventListener("click", exportLocal);
  elements.importLocal.addEventListener("change", importLocal);
  ensureLocalhostForDrive();
}

init();
