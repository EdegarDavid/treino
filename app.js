const STORAGE_KEY = "treino-app:v2";
const LEGACY_STORAGE_KEY = "treino-app:v1";

const state = {
  workouts: [],
  apiUrl: "",
  lastSync: "",
};

// Preencher com a URL do Apps Script fornecida pelo usuario
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbx4P2pES1r7r7onQ_r0Qk_OPD796mqsNRUOcEejExDy5BLzVgKYvAqyUsRyAynkrA/exec';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const today = new Date().toISOString().slice(0, 10);

function loadState() {
  const saved = readJson(STORAGE_KEY) || readJson(LEGACY_STORAGE_KEY) || {};
  state.workouts = Array.isArray(saved.workouts) ? saved.workouts : [];
  state.apiUrl = saved.apiUrl || DEFAULT_API_URL || "";
  state.lastSync = saved.lastSync || "";
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function exerciseNames() {
  return [...new Set(state.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.name)).filter(Boolean))].sort();
}

function addExerciseRow(exercise = {}) {
  const fragment = $("#exerciseTemplate").content.cloneNode(true);
  const row = fragment.querySelector(".exercise-row");
  row.querySelector(".exercise-name").value = exercise.name || "";
  row.querySelector(".exercise-sets").value = exercise.sets || "";
  row.querySelector(".exercise-reps").value = exercise.reps || "";
  row.querySelector(".exercise-load").value = exercise.load || "";
  row.querySelector(".remove-row").addEventListener("click", () => {
    if ($$("#exerciseRows .exercise-row").length > 1) row.remove();
  });
  $("#exerciseRows").append(row);
}

function resetForm() {
  $("#workoutDate").value = today;
  $("#workoutType").value = "Musculacao";
  $("#workoutName").value = "";
  $("#workoutNotes").value = "";
  $("#exerciseRows").innerHTML = "";
  addExerciseRow();
}

function readExercises() {
  return $$("#exerciseRows .exercise-row")
    .map((row) => ({
      name: row.querySelector(".exercise-name").value.trim(),
      sets: Number(row.querySelector(".exercise-sets").value || 0),
      reps: Number(row.querySelector(".exercise-reps").value || 0),
      load: Number(row.querySelector(".exercise-load").value || 0),
    }))
    .filter((exercise) => exercise.name);
}

function renderSummary() {
  const sorted = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  $("#totalWorkouts").textContent = state.workouts.length;
  $("#weekWorkouts").textContent = state.workouts.filter((workout) => new Date(`${workout.date}T00:00:00`) >= startOfWeek).length;
  $("#lastWorkout").textContent = sorted[0] ? formatDate(sorted[0].date).slice(0, 5) : "-";
}

function renderSyncStatus() {
  const apiInput = $("#apiUrlInput");
  if (apiInput) apiInput.value = state.apiUrl;
  $("#syncTitle").textContent = state.apiUrl ? "Google Sheets conectado" : "Modo local";
  $("#syncStatus").textContent = state.apiUrl
    ? `Ultima sincronizacao: ${state.lastSync ? new Date(state.lastSync).toLocaleString("pt-BR") : "ainda nao feita"}`
    : "Sincroniza automaticamente com Google Sheets quando configurado.";
}

function renderHistory() {
  const list = $("#historyList");
  const sorted = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (!sorted.length) {
    list.innerHTML = '<p class="empty">Nenhum treino salvo ainda.</p>';
    return;
  }

  list.innerHTML = sorted.map((workout) => `
    <article class="workout-card">
      <div class="card-head">
        <div class="card-title">
          <strong>${escapeHtml(workout.name)}</strong>
          <span>${formatDate(workout.date)}</span>
        </div>
        <span class="tag">${escapeHtml(workout.type)}</span>
      </div>
      <ul class="exercise-list">
        ${workout.exercises.map((exercise) => `
          <li>
            <strong>${escapeHtml(exercise.name)}</strong>
            <span>${exercise.sets || 0} series · ${exercise.reps || 0} reps · ${exercise.load || 0} kg</span>
          </li>
        `).join("")}
      </ul>
      ${workout.notes ? `<p class="note">${escapeHtml(workout.notes)}</p>` : ""}
      <button class="delete-workout" type="button" data-id="${workout.id}">Excluir</button>
    </article>
  `).join("");

  $$(".delete-workout").forEach((button) => {
    button.addEventListener("click", async () => {
      state.workouts = state.workouts.filter((workout) => workout.id !== button.dataset.id);
      saveState();
      render();
      await syncToSheets("save");
    });
  });
}

function renderLibrary() {
  const library = $("#exerciseLibrary");
  const names = exerciseNames();
  $("#exerciseOptions").innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  library.innerHTML = names.length
    ? names.map((name) => `<div class="library-item"><strong>${escapeHtml(name)}</strong><span>${countExercise(name)}x</span></div>`).join("")
    : '<p class="empty">Os exercicios aparecem aqui depois que voce salvar treinos.</p>';
}

function renderProgress() {
  const select = $("#progressExercise");
  const current = select.value;
  const names = exerciseNames();
  select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  select.value = names.includes(current) ? current : names[0] || "";

  const points = progressPoints(select.value);
  drawChart(points);
  renderProgressStats(points);
}

function progressPoints(name) {
  if (!name) return [];
  return state.workouts
    .flatMap((workout) => workout.exercises.filter((exercise) => exercise.name === name).map((exercise) => ({
      date: workout.date,
      load: Number(exercise.load || 0),
      volume: Number(exercise.load || 0) * Number(exercise.reps || 0) * Number(exercise.sets || 0),
    })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function drawChart(points) {
  const canvas = $("#progressChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 42;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#68736e";
    ctx.font = "18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Salve treinos para ver sua progressao.", width / 2, height / 2);
    return;
  }

  const max = Math.max(...points.map((point) => point.load), 1);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  ctx.strokeStyle = "#d9ded4";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + ((height - pad * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#157f73";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = points.length === 1 ? width / 2 : pad + stepX * index;
    const y = height - pad - (point.load / max) * (height - pad * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    const x = points.length === 1 ? width / 2 : pad + stepX * index;
    const y = height - pad - (point.load / max) * (height - pad * 2);
    ctx.fillStyle = "#d57a43";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderProgressStats(points) {
  const box = $("#progressStats");
  if (!points.length) {
    box.innerHTML = '<p class="empty">Escolha um exercicio com cargas registradas.</p>';
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const bestLoad = Math.max(...points.map((point) => point.load));
  const bestVolume = Math.max(...points.map((point) => point.volume));
  const delta = last.load - first.load;
  // Suggestion: simple rule based on last recorded reps
  // If last reps >= target -> suggest increasing by PROGRESSION_INCREMENT
  const lastReps = points[points.length - 1].reps || 0;
  const lastSets = points[points.length - 1].sets || 0;
  const lastLoad = last.load || 0;
  let suggestion = 'Sem sugestao';
  if (lastLoad > 0) {
    if (lastReps >= PROGRESSION_TARGET_REPS) {
      suggestion = `Tente ${lastLoad + PROGRESSION_INCREMENT} kg (aumentar ${PROGRESSION_INCREMENT} kg)`;
    } else {
      suggestion = `Mantenha ${lastLoad} kg e foque em atingir ${PROGRESSION_TARGET_REPS} reps`;
    }
  }

  box.innerHTML = `
    <article><strong>${bestLoad} kg</strong><span>maior carga</span></article>
    <article><strong>${delta >= 0 ? '+' : ''}${delta} kg</strong><span>evolucao</span></article>
    <article><strong>${Math.round(bestVolume)} kg</strong><span>maior volume</span></article>
    <article><strong>${escapeHtml(suggestion)}</strong><span>sugestao</span></article>
  `;
}

function countExercise(name) {
  return state.workouts.reduce((count, workout) => count + workout.exercises.filter((exercise) => exercise.name === name).length, 0);
}

function render() {
  renderSummary();
  renderSyncStatus();
  renderHistory();
  renderLibrary();
  renderProgress();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function setActiveTab(name) {
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  $$(".panel").forEach((panel) => panel.classList.remove("is-active"));
  $(`#${name}Panel`).classList.add("is-active");
}

async function syncToSheets(action = "save") {
  if (!state.apiUrl) {
    console.warn('syncToSheets: apiUrl nao configurada');
    $("#syncStatus").textContent = "Configure a URL do Apps Script antes de sincronizar.";
    return;
  }

  const btn = $("#syncButton");
  const prevDisabled = btn.disabled;
  const prevText = btn.textContent;
  try {
    btn.disabled = true;
    btn.classList.add('is-busy');
    console.log('syncToSheets start', { action, apiUrl: state.apiUrl, workouts: state.workouts.length });
    $("#syncStatus").textContent = "Sincronizando...";
    const response = await fetch(state.apiUrl, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, workouts: state.workouts }),
    });
    const payloadText = await response.text();
    let payload;
    try { payload = JSON.parse(payloadText || '{}'); } catch (e) { payload = { ok: false, error: 'Resposta invalida: ' + payloadText }; }
    if (!payload.ok) throw new Error(payload.error || "Falha na sincronizacao");
    if (Array.isArray(payload.workouts)) state.workouts = payload.workouts;
    state.lastSync = new Date().toISOString();
    saveState();
    render();
    console.log('syncToSheets ok');
    $("#syncStatus").textContent = `Ultima sincronizacao: ${new Date(state.lastSync).toLocaleString('pt-BR')}`;
  } catch (error) {
    console.error('syncToSheets error', error);
    $("#syncStatus").textContent = "Nao foi possivel sincronizar. Os dados locais foram mantidos.";
    alert('Erro ao sincronizar: ' + (error && error.message ? error.message : error));
  } finally {
    btn.disabled = prevDisabled;
    btn.classList.remove('is-busy');
    btn.textContent = prevText;
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `treinos-${today}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.workouts)) throw new Error("Arquivo invalido");
      state.workouts = imported.workouts;
      saveState();
      render();
      await syncToSheets("save");
    } catch {
      alert("Nao consegui importar esse arquivo.");
    }
  });
  reader.readAsText(file);
}

function bindEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
  $("#progressExercise").addEventListener("change", renderProgress);
  $("#addExerciseButton").addEventListener("click", () => addExerciseRow());
  $("#exportButton").addEventListener("click", exportData);
  $("#syncButton").addEventListener("click", () => syncToSheets("load"));
  // settings dialog removed — app uses DEFAULT_API_URL from code
  $("#importInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importData(file);
    event.target.value = "";
  });
  $("#clearButton").addEventListener("click", async () => {
    if (!state.workouts.length || !confirm("Apagar todos os treinos salvos?")) return;
    state.workouts = [];
    saveState();
    render();
    await syncToSheets("save");
  });
  $("#workoutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const exercises = readExercises();
    if (!exercises.length) {
      alert("Adicione pelo menos um exercicio.");
      return;
    }
    state.workouts.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: $("#workoutDate").value,
      type: $("#workoutType").value,
      name: $("#workoutName").value.trim(),
      notes: $("#workoutNotes").value.trim(),
      exercises,
    });
    saveState();
    render();
    resetForm();
    setActiveTab("history");
    await syncToSheets("save");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

loadState();
bindEvents();
resetForm();
render();
// Auto-save default API URL and auto-load from Sheets if available
if (state.apiUrl) {
  saveState();
  setTimeout(() => {
    syncToSheets('load').catch(() => {});
  }, 200);
}
