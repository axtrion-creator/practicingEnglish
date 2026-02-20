const DEFAULT_CHAPTER = "General";
const DB_CONFIG_STORAGE_KEY = "finnish_trainer_supabase_config_v1";
const PRACTICE_PREF_STORAGE_KEY = "finnish_trainer_practice_prefs_v1";
const CHAPTER_CACHE_STORAGE_KEY = "finnish_trainer_chapter_cache_v1";

const timedToggle = document.getElementById("timedToggle");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const startBtn = document.getElementById("startBtn");
const scopeSelect = document.getElementById("scopeSelect");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const miniSettingsBtn = document.getElementById("miniSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const checkWriteBtn = document.getElementById("checkWriteBtn");
const flashSubmitBtn = document.getElementById("flashSubmitBtn");
const flashSkipBtn = document.getElementById("flashSkipBtn");
const flashInput = document.getElementById("flashInput");
const scopeInlineError = document.getElementById("scopeInlineError");
const chapterMetaText = document.getElementById("chapterMetaText");
const syncInlineError = document.getElementById("syncInlineError");
const readySummaryText = document.getElementById("readySummaryText");
const activePlayerBadge = document.getElementById("activePlayerBadge");
const syncIndicatorBadge = document.getElementById("syncIndicatorBadge");
const statusText = document.getElementById("statusText");
const scoreText = document.getElementById("scoreText");
const timerText = document.getElementById("timerText");
const gameplayArea = document.getElementById("gameplayArea");
const settingsModal = document.getElementById("settingsModal");
const board = document.getElementById("board");
const lineLayer = document.getElementById("lineLayer");
const finnishColumn = document.getElementById("finnishColumn");
const englishColumn = document.getElementById("englishColumn");
const matchWrap = document.getElementById("matchWrap");
const writeWrap = document.getElementById("writeWrap");
const flashWrap = document.getElementById("flashWrap");
const writeList = document.getElementById("writeList");
const flashProgress = document.getElementById("flashProgress");
const flashWord = document.getElementById("flashWord");
const flashFeedback = document.getElementById("flashFeedback");
const miniBar = document.getElementById("miniBar");
const miniDataset = document.getElementById("miniDataset");
const miniChapter = document.getElementById("miniChapter");
const miniMode = document.getElementById("miniMode");
const miniTimer = document.getElementById("miniTimer");
const miniProgress = document.getElementById("miniProgress");

const supabaseUrlInput = document.getElementById("supabaseUrlInput");
const supabaseKeyInput = document.getElementById("supabaseKeyInput");
const playerNameInput = document.getElementById("playerNameInput");
const connectDbBtn = document.getElementById("connectDbBtn");
const chapterSelect = document.getElementById("chapterSelect");
const dbStatusText = document.getElementById("dbStatusText");
const dbStatsText = document.getElementById("dbStatsText");

const MODES = {
  MATCH: "match",
  WRITE: "write",
  FLASH: "flash",
};

const MODE_LABELS = {
  [MODES.MATCH]: "Combine boxes",
  [MODES.WRITE]: "Write translations",
  [MODES.FLASH]: "Flashcards",
};

const state = {
  rawPairs: [],
  pairs: [],
  mode: MODES.MATCH,
  timed: false,
  timerId: null,
  timeLeft: 60,
  gameOver: false,
  selectedLeft: null,
  selectedRight: null,
  connections: new Map(),
  flashQueue: [],
  flashIndex: 0,
  writeSubmitted: false,
  correct: 0,
  attempts: 0,
  wordStats: new Map(),
  currentChapter: "All words",
  source: "database",
  datasetLabel: "Database",
  scope: "all",
  selectedChapter: "",
  chapterCatalog: [],
  roundStarted: false,
  roundSaved: false,
  db: {
    client: null,
    connected: false,
  },
};

if (startBtn) {
  startBtn.addEventListener("click", () => {
    void startPractice();
  });
}
modeButtons.forEach((button) => {
  button.addEventListener("click", () => onModeChange(button.dataset.mode));
});
if (scopeSelect) {
  scopeSelect.addEventListener("change", onScopeChange);
}
if (timedToggle) {
  timedToggle.addEventListener("change", onTimedToggle);
}
if (chapterSelect) {
  chapterSelect.addEventListener("change", onChapterSelectionChange);
}
if (checkWriteBtn) {
  checkWriteBtn.addEventListener("click", () => submitWriteAnswers(false));
}
if (flashSubmitBtn) {
  flashSubmitBtn.addEventListener("click", submitFlashAnswer);
}
if (flashSkipBtn) {
  flashSkipBtn.addEventListener("click", skipFlashCard);
}
if (flashInput) {
  flashInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitFlashAnswer();
    }
  });
}
if (connectDbBtn) {
  connectDbBtn.addEventListener("click", connectToSupabase);
}
if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", openSettingsModal);
}
if (miniSettingsBtn) {
  miniSettingsBtn.addEventListener("click", openSettingsModal);
}
if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", closeSettingsModal);
}
if (settingsModal) {
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      closeSettingsModal();
    }
  });
}
if (playerNameInput) {
  playerNameInput.addEventListener("change", () => {
    persistDbConfigToStorage();
    updateQuickStartCard();
    if (state.db.connected) {
      void refreshPlayerStats();
      if (state.scope === "chapter" && state.selectedChapter) {
        void loadChapterMetadata(state.selectedChapter);
      }
    }
  });
}
window.addEventListener("resize", syncAllLines);

hydrateDbConfigFromStorage();
hydratePracticePrefsFromStorage();
resetChapterControls();
hydrateChapterCacheFromStorage();
applyPracticeScope();
updateQuickStartCard();
setStatus("Choose scope and press Start.");
setDbStatus("Sync: Offline.");
updateScore();
updateTimerDisplay();
updateReadySummary();
updateMiniBar();
if (state.scope === "chapter" && state.selectedChapter) {
  void loadChapterMetadata(state.selectedChapter);
}
void initializePracticePage();

async function initializePracticePage() {
  if (!hasStoredDbConfig()) {
    return;
  }

  await autoConnectFromStoredConfig();
}

async function startPractice() {
  clearScopeError();

  if (!state.db.connected) {
    setScopeError("Sync is offline. Open Settings and connect Sync first.");
    openSettingsModal();
    return;
  }

  if (state.scope === "chapter" && !state.selectedChapter) {
    setScopeError("Choose a chapter before starting.");
    return;
  }

  const words = await loadWordsForActiveScope();
  if (!words) {
    return;
  }

  state.roundStarted = true;
  state.source = "database";
  state.datasetLabel = "Database";
  state.rawPairs = words;
  state.currentChapter = state.scope === "chapter" ? state.selectedChapter : "All words";

  gameplayArea.classList.remove("hidden");
  miniBar.classList.remove("hidden");
  startRound();
  updateMiniBar();
  setStatus(`Started with ${state.rawPairs.length} words from ${state.currentChapter}.`);
}

function onScopeChange() {
  clearScopeError();
  state.scope = scopeSelect.value === "chapter" ? "chapter" : "all";
  applyPracticeScope();
  persistPracticePrefsToStorage();

  if (state.scope === "chapter" && state.selectedChapter) {
    void loadChapterMetadata(state.selectedChapter);
  } else {
    hideChapterMetadata();
  }
}

function onChapterSelectionChange() {
  clearScopeError();
  state.selectedChapter = chapterSelect.value || "";
  persistPracticePrefsToStorage();

  if (state.scope === "chapter" && state.selectedChapter) {
    void loadChapterMetadata(state.selectedChapter);
    return;
  }

  hideChapterMetadata();
}

function onModeChange(mode) {
  if (!mode || mode === state.mode) {
    return;
  }

  setActiveModeButton(mode);
  state.mode = mode;

  updateReadySummary();
  if (state.roundStarted && state.rawPairs.length) {
    startRound();
    setStatus(getModeIntroText());
  }
  updateMiniBar();
}

function onTimedToggle() {
  state.timed = timedToggle.checked;
  updateReadySummary();
  updateMiniBar();

  if (state.roundStarted && state.rawPairs.length) {
    startRound();
    setStatus(state.timed ? "Timed mode enabled: 1:00 starts now." : getModeIntroText());
  } else {
    updateTimerDisplay();
  }
}

function startRound() {
  stopTimer();
  resetRoundState();
  state.mode = getActiveMode();
  state.timed = timedToggle.checked;
  state.pairs = state.rawPairs.map((pair, index) => ({
    id: String(index + 1),
    wordId: pair.wordId,
    finnish: pair.finnish,
    english: pair.english,
    englishNorm: normalize(pair.english),
    chapter: pair.chapter,
  }));
  initializeWordStats();

  setModeVisibility();

  if (state.mode === MODES.MATCH) {
    renderMatchMode();
  } else if (state.mode === MODES.WRITE) {
    renderWriteMode();
  } else {
    renderFlashMode();
  }

  if (state.timed) {
    startTimer();
  } else {
    updateTimerDisplay();
  }

  updateScore();
  updateMiniBar();
}

function resetRoundState() {
  state.correct = 0;
  state.attempts = 0;
  state.gameOver = false;
  state.selectedLeft = null;
  state.selectedRight = null;
  state.connections.clear();
  state.flashQueue = [];
  state.flashIndex = 0;
  state.writeSubmitted = false;
  state.timeLeft = 60;
  state.wordStats = new Map();
  state.roundSaved = false;

  lineLayer.innerHTML = "";
  finnishColumn.innerHTML = "";
  englishColumn.innerHTML = "";
  writeList.innerHTML = "";
  flashFeedback.textContent = "";
  flashInput.value = "";
}

function initializeWordStats() {
  state.pairs.forEach((pair) => {
    state.wordStats.set(pair.id, {
      wordId: pair.wordId,
      chapter: pair.chapter,
      finnish: pair.finnish,
      english: pair.english,
      attempts: 0,
      correct: 0,
    });
  });
}

function recordWordAttempt(pairId, isCorrect) {
  const entry = state.wordStats.get(pairId);
  if (!entry) {
    return;
  }

  entry.attempts += 1;
  if (isCorrect) {
    entry.correct += 1;
  }
}

function setModeVisibility() {
  matchWrap.classList.toggle("hidden", state.mode !== MODES.MATCH);
  writeWrap.classList.toggle("hidden", state.mode !== MODES.WRITE);
  flashWrap.classList.toggle("hidden", state.mode !== MODES.FLASH);
}

function renderMatchMode() {
  const finnishSorted = [...state.pairs].sort((a, b) =>
    a.finnish.localeCompare(b.finnish, "fi", { sensitivity: "base" }),
  );
  const englishSorted = [...state.pairs].sort((a, b) =>
    a.english.localeCompare(b.english, "en", { sensitivity: "base" }),
  );

  finnishSorted.forEach((pair) => {
    finnishColumn.appendChild(createWordBox(pair.finnish, pair.id, "left"));
  });

  englishSorted.forEach((pair) => {
    englishColumn.appendChild(createWordBox(pair.english, pair.id, "right"));
  });

  resizeLineLayer();
}

function renderWriteMode() {
  const fragment = document.createDocumentFragment();

  state.pairs.forEach((pair) => {
    const row = document.createElement("div");
    row.className = "write-row";
    row.dataset.pairId = pair.id;

    const finnishLabel = document.createElement("p");
    finnishLabel.className = "write-finnish";
    finnishLabel.textContent = pair.finnish;

    const input = document.createElement("input");
    input.className = "write-input";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Type English translation";

    const result = document.createElement("p");
    result.className = "write-result";
    result.textContent = "";

    row.appendChild(finnishLabel);
    row.appendChild(input);
    row.appendChild(result);
    fragment.appendChild(row);
  });

  writeList.appendChild(fragment);
  checkWriteBtn.disabled = false;
}

function renderFlashMode() {
  state.flashQueue = shuffleArray([...state.pairs]);
  state.flashIndex = 0;
  updateFlashCard();
}

function createWordBox(text, pairId, side) {
  const box = document.createElement("button");
  box.type = "button";
  box.className = "word-box";
  box.textContent = text;
  box.dataset.pairId = pairId;
  box.dataset.side = side;

  box.addEventListener("click", () => {
    onMatchWordClick(box);
  });

  return box;
}

function onMatchWordClick(box) {
  if (state.mode !== MODES.MATCH || state.gameOver || box.classList.contains("matched")) {
    return;
  }

  const side = box.dataset.side;

  if (side === "left") {
    setSelected("left", box);
  } else {
    setSelected("right", box);
  }

  if (state.selectedLeft && state.selectedRight) {
    evaluateMatchSelection();
  }
}

function setSelected(side, box) {
  if (side === "left") {
    if (state.selectedLeft) {
      state.selectedLeft.classList.remove("selected");
    }
    state.selectedLeft = box;
    state.selectedLeft.classList.add("selected");
    return;
  }

  if (state.selectedRight) {
    state.selectedRight.classList.remove("selected");
  }
  state.selectedRight = box;
  state.selectedRight.classList.add("selected");
}

function evaluateMatchSelection() {
  const left = state.selectedLeft;
  const right = state.selectedRight;
  const leftId = left.dataset.pairId;
  const rightId = right.dataset.pairId;
  const isCorrect = leftId === rightId;

  state.attempts += 1;

  if (isCorrect) {
    state.correct += 1;
    recordWordAttempt(leftId, true);
    markAsMatched(left, right, leftId);
    setStatus(`Correct. ${state.correct} matches found.`);
  } else {
    recordWordAttempt(leftId, false);
    if (rightId !== leftId) {
      recordWordAttempt(rightId, false);
    }
    drawTempLine(left, right);
    flashError(left, right);
    setStatus("Not a match. Try again.", true);
  }

  left.classList.remove("selected");
  right.classList.remove("selected");
  state.selectedLeft = null;
  state.selectedRight = null;
  updateScore();

  if (state.correct === state.pairs.length) {
    completeRound(`All done. You matched all ${state.pairs.length} pairs.`, "completed");
  }
}

function markAsMatched(left, right, pairId) {
  left.classList.add("matched");
  right.classList.add("matched");
  left.disabled = true;
  right.disabled = true;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#1b8755");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  lineLayer.appendChild(line);

  const connection = { left, right, line };
  state.connections.set(pairId, connection);
  positionLine(connection);
}

function drawTempLine(left, right) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#c23a4e");
  line.setAttribute("stroke-width", "2.5");
  line.setAttribute("stroke-dasharray", "7 6");
  line.setAttribute("stroke-linecap", "round");
  lineLayer.appendChild(line);

  const connection = { left, right, line };
  positionLine(connection);

  window.setTimeout(() => {
    line.remove();
  }, 520);
}

function flashError(left, right) {
  left.classList.add("error");
  right.classList.add("error");

  window.setTimeout(() => {
    left.classList.remove("error");
    right.classList.remove("error");
  }, 380);
}

function submitWriteAnswers(fromTimer) {
  if (state.mode !== MODES.WRITE || state.gameOver || state.writeSubmitted) {
    return;
  }

  const rows = [...writeList.querySelectorAll(".write-row")];
  let checkedCount = 0;
  let correctCount = 0;

  rows.forEach((row) => {
    const pair = state.pairs.find((item) => item.id === row.dataset.pairId);
    const input = row.querySelector(".write-input");
    const result = row.querySelector(".write-result");
    const typed = normalize(input.value);
    const hasText = typed.length > 0;
    const shouldEvaluate = fromTimer ? hasText : true;

    input.disabled = true;
    row.classList.remove("correct", "wrong", "unanswered");

    if (!shouldEvaluate) {
      row.classList.add("unanswered");
      result.textContent = "No answer before time ended.";
      return;
    }

    const isCorrect = typed === pair.englishNorm;
    checkedCount += 1;
    recordWordAttempt(pair.id, isCorrect);

    if (isCorrect) {
      correctCount += 1;
      row.classList.add("correct");
      result.textContent = "Correct";
    } else {
      row.classList.add("wrong");
      result.textContent = `Correct answer: ${pair.english}`;
    }
  });

  state.correct = correctCount;
  state.attempts = checkedCount;
  state.writeSubmitted = true;
  state.gameOver = true;
  checkWriteBtn.disabled = true;
  stopTimer();
  updateTimerDisplay();
  updateScore();

  if (fromTimer) {
    setStatus(`Time is up. Checked ${checkedCount} answers.`);
    void saveProgress("timeout");
  } else {
    setStatus(`Finished writing mode. ${correctCount} correct.`);
    void saveProgress("completed");
  }
}

function updateFlashCard() {
  const total = state.flashQueue.length;
  const current = state.flashQueue[state.flashIndex];

  if (!current) {
    completeRound(`Flashcards complete. ${state.correct} correct answers.`, "completed");
    return;
  }

  flashProgress.textContent = `Card ${state.flashIndex + 1} of ${total}`;
  flashWord.textContent = current.finnish;
  flashInput.value = "";
  flashInput.disabled = false;
  flashSubmitBtn.disabled = false;
  flashSkipBtn.disabled = false;
  flashFeedback.textContent = "";
  flashFeedback.classList.remove("error", "ok");
  flashInput.focus();
}

function submitFlashAnswer() {
  if (state.mode !== MODES.FLASH || state.gameOver) {
    return;
  }

  const current = state.flashQueue[state.flashIndex];
  if (!current) {
    return;
  }

  const answer = normalize(flashInput.value);
  if (!answer) {
    flashFeedback.textContent = "Type an answer first.";
    flashFeedback.classList.add("error");
    flashFeedback.classList.remove("ok");
    return;
  }

  const isCorrect = answer === current.englishNorm;
  state.attempts += 1;
  recordWordAttempt(current.id, isCorrect);

  if (isCorrect) {
    state.correct += 1;
    flashFeedback.textContent = "Correct.";
    flashFeedback.classList.add("ok");
    flashFeedback.classList.remove("error");
  } else {
    flashFeedback.textContent = `Wrong. Correct answer: ${current.english}`;
    flashFeedback.classList.add("error");
    flashFeedback.classList.remove("ok");
  }

  updateScore();
  flashInput.disabled = true;
  flashSubmitBtn.disabled = true;
  flashSkipBtn.disabled = true;

  window.setTimeout(() => {
    if (state.gameOver) {
      return;
    }
    state.flashIndex += 1;
    updateFlashCard();
    updateScore();
  }, 600);
}

function skipFlashCard() {
  if (state.mode !== MODES.FLASH || state.gameOver) {
    return;
  }

  state.flashIndex += 1;
  updateFlashCard();
  updateScore();
}

function completeRound(message, reason) {
  state.gameOver = true;
  stopTimer();
  updateTimerDisplay();
  disableCurrentModeInputs();
  setStatus(message);
  void saveProgress(reason);
}

function disableCurrentModeInputs() {
  if (state.mode === MODES.MATCH) {
    board.querySelectorAll(".word-box").forEach((box) => {
      box.disabled = true;
    });
    return;
  }

  if (state.mode === MODES.WRITE) {
    writeList.querySelectorAll(".write-input").forEach((input) => {
      input.disabled = true;
    });
    checkWriteBtn.disabled = true;
    return;
  }

  flashInput.disabled = true;
  flashSubmitBtn.disabled = true;
  flashSkipBtn.disabled = true;
}

function startTimer() {
  stopTimer();
  state.timeLeft = 60;
  updateTimerDisplay();

  state.timerId = window.setInterval(() => {
    if (state.gameOver) {
      return;
    }

    state.timeLeft -= 1;
    updateTimerDisplay();

    if (state.timeLeft <= 0) {
      onTimeExpired();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function onTimeExpired() {
  stopTimer();
  state.timeLeft = 0;
  updateTimerDisplay();

  if (state.mode === MODES.WRITE && !state.writeSubmitted) {
    submitWriteAnswers(true);
    return;
  }

  state.gameOver = true;
  disableCurrentModeInputs();
  setStatus("Time is up. Restart or switch mode to continue.");
  void saveProgress("timeout");
}

function updateScore() {
  if (state.mode === MODES.WRITE) {
    scoreText.textContent = `${state.correct} correct / ${state.attempts} checked`;
    updateMiniBar();
    return;
  }

  scoreText.textContent = `${state.correct} correct / ${state.attempts} attempts`;
  updateMiniBar();
}

function updateTimerDisplay() {
  if (!state.timed) {
    timerText.textContent = "Timer: Off";
    timerText.classList.remove("timer-warning");
    updateMiniBar();
    return;
  }

  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = String(state.timeLeft % 60).padStart(2, "0");
  timerText.textContent = `Time left: ${minutes}:${seconds}`;
  timerText.classList.toggle("timer-warning", state.timeLeft <= 10);
  updateMiniBar();
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
  updateMiniBar();
}

function setDbStatus(message, isError = false) {
  dbStatusText.textContent = message;
  dbStatusText.classList.toggle("error", isError);
  updateQuickStartCard();
  if (!isError) {
    clearSyncError();
    return;
  }

  setSyncError(message);
}

function updateReadySummary() {
  if (!readySummaryText) {
    return;
  }

  if (!state.rawPairs.length) {
    readySummaryText.textContent = "Choose scope and press Start.";
    return;
  }

  readySummaryText.textContent = `${state.rawPairs.length} words ready | Chapter: ${state.currentChapter} | Mode: ${getModeLabel(state.mode)}`;
}

function updateMiniBar() {
  if (!miniBar) {
    return;
  }

  miniDataset.textContent = `Dataset: ${state.datasetLabel || "-"}`;
  miniChapter.textContent = `Chapter: ${state.currentChapter || "-"}`;
  miniMode.textContent = `Mode: ${getModeLabel(state.mode)}`;
  miniTimer.textContent = timerText.textContent || "Timer: Off";
  miniProgress.textContent = `Progress: ${state.correct} correct / ${state.attempts} attempts`;
}

function getModeLabel(mode) {
  return MODE_LABELS[mode] || mode || "-";
}

function updateQuickStartCard() {
  if (activePlayerBadge) {
    activePlayerBadge.textContent = `Player: ${getPlayerName() || "-"}`;
  }

  if (syncIndicatorBadge) {
    syncIndicatorBadge.textContent = state.db.connected ? "Synced" : "Offline";
    syncIndicatorBadge.classList.toggle("synced", state.db.connected);
    syncIndicatorBadge.classList.toggle("offline", !state.db.connected);
  }
}

function setScopeError(message) {
  if (!scopeInlineError) {
    return;
  }

  scopeInlineError.textContent = message;
  scopeInlineError.classList.remove("hidden");
}

function clearScopeError() {
  if (!scopeInlineError) {
    return;
  }

  scopeInlineError.textContent = "";
  scopeInlineError.classList.add("hidden");
}

function setSyncError(message) {
  if (!syncInlineError) {
    return;
  }
  syncInlineError.textContent = message;
  syncInlineError.classList.remove("hidden");
}

function clearSyncError() {
  if (!syncInlineError) {
    return;
  }
  syncInlineError.textContent = "";
  syncInlineError.classList.add("hidden");
}

function openSettingsModal() {
  settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  settingsModal.classList.add("hidden");
}

function applyPracticeScope() {
  if (!scopeSelect || !chapterSelect) {
    return;
  }

  scopeSelect.value = state.scope;
  const needsChapter = state.scope === "chapter";
  chapterSelect.disabled = !needsChapter || state.chapterCatalog.length === 0;

  if (!needsChapter) {
    hideChapterMetadata();
  }
}

function hideChapterMetadata() {
  if (!chapterMetaText) {
    return;
  }

  chapterMetaText.textContent = "";
  chapterMetaText.classList.add("hidden");
}

async function loadChapterMetadata(chapter) {
  if (!chapter || !chapterMetaText) {
    return;
  }

  const chapterInfo = state.chapterCatalog.find((item) => item.chapter === chapter);
  const wordCount = chapterInfo?.count ?? 0;
  const playerName = getPlayerName();

  if (!state.db.connected || !playerName) {
    chapterMetaText.textContent = `Words: ${wordCount} | Last practiced: - | Accuracy: -`;
    chapterMetaText.classList.remove("hidden");
    return;
  }

  const { data, error } = await state.db.client
    .from("progress_sessions")
    .select("completed_at, correct_count, attempts_count")
    .eq("user_name", playerName)
    .eq("chapter", chapter)
    .order("completed_at", { ascending: false })
    .limit(200);

  if (error) {
    chapterMetaText.textContent = `Words: ${wordCount} | Last practiced: - | Accuracy: -`;
    chapterMetaText.classList.remove("hidden");
    return;
  }

  const lastPracticed = data?.[0]?.completed_at ? formatDate(data[0].completed_at) : "-";
  const totalAttempts = (data || []).reduce((sum, row) => sum + (row.attempts_count || 0), 0);
  const totalCorrect = (data || []).reduce((sum, row) => sum + (row.correct_count || 0), 0);
  const accuracy = totalAttempts > 0 ? `${Math.round((totalCorrect / totalAttempts) * 100)}%` : "-";

  chapterMetaText.textContent = `Words: ${wordCount} | Last practiced: ${lastPracticed} | Accuracy: ${accuracy}`;
  chapterMetaText.classList.remove("hidden");
}

async function loadWordsForActiveScope() {
  if (!state.db.connected) {
    setScopeError("Sync is offline. Open Settings and connect Sync first.");
    return null;
  }

  let query = state.db.client
    .from("words")
    .select("id, chapter, finnish, english")
    .order("chapter", { ascending: true })
    .order("finnish", { ascending: true });

  if (state.scope === "chapter") {
    query = query.eq("chapter", state.selectedChapter);
  }

  const { data, error } = await query;
  if (error) {
    setScopeError(`Could not load words: ${error.message}`);
    return null;
  }

  if (!data || data.length < 2) {
    setScopeError("Selected scope has too few words (need at least 2).");
    return null;
  }

  return data.map((row) => ({
    wordId: row.id,
    chapter: normalizeChapter(row.chapter),
    finnish: row.finnish,
    english: row.english,
  }));
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function getModeIntroText() {
  if (state.mode === MODES.WRITE) {
    return "Write English translation for each Finnish word, then check answers.";
  }

  if (state.mode === MODES.FLASH) {
    return "Flashcard mode: type the English translation one card at a time.";
  }

  return "Match Finnish words to English words by connecting boxes.";
}

function getActiveMode() {
  const activeButton = modeButtons.find((button) => button.classList.contains("active"));
  return activeButton ? activeButton.dataset.mode : MODES.MATCH;
}

function setActiveModeButton(mode) {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function normalizeChapter(value) {
  const chapter = String(value ?? "").trim();
  return chapter || DEFAULT_CHAPTER;
}

function positionLine(connection) {
  const boardRect = board.getBoundingClientRect();
  const leftRect = connection.left.getBoundingClientRect();
  const rightRect = connection.right.getBoundingClientRect();

  const x1 = leftRect.right - boardRect.left;
  const y1 = leftRect.top + leftRect.height / 2 - boardRect.top;
  const x2 = rightRect.left - boardRect.left;
  const y2 = rightRect.top + rightRect.height / 2 - boardRect.top;

  connection.line.setAttribute("x1", String(x1));
  connection.line.setAttribute("y1", String(y1));
  connection.line.setAttribute("x2", String(x2));
  connection.line.setAttribute("y2", String(y2));
}

function syncAllLines() {
  if (state.mode !== MODES.MATCH) {
    return;
  }

  resizeLineLayer();
  state.connections.forEach((connection) => {
    positionLine(connection);
  });
}

function resizeLineLayer() {
  lineLayer.setAttribute("viewBox", `0 0 ${board.clientWidth} ${board.clientHeight}`);
}

async function connectToSupabase() {
  clearSyncError();
  const url = supabaseUrlInput.value.trim();
  const anonKey = supabaseKeyInput.value.trim();

  if (!url || !anonKey) {
    setSyncError("Enter Supabase URL and Access key in Advanced.");
    return;
  }

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    setSyncError("Supabase client did not load. Refresh the page.");
    return;
  }

  const client = supabase.createClient(url, anonKey);
  const { error } = await client.from("words").select("id").limit(1);

  if (error) {
    setSyncError(`Sync connection failed: ${error.message}`);
    setDbStatus("Sync: Offline.", true);
    return;
  }

  state.db.client = client;
  state.db.connected = true;
  persistDbConfigToStorage();
  updateQuickStartCard();
  clearScopeError();
  await fetchChapters();
  await refreshPlayerStats();
  setDbStatus("Sync: Synced.");
  if (state.scope === "chapter" && state.selectedChapter) {
    await loadChapterMetadata(state.selectedChapter);
  }
  closeSettingsModal();
}

async function autoConnectFromStoredConfig() {
  if (!hasStoredDbConfig()) {
    return;
  }

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    setDbStatus("Sync: Offline.");
    return;
  }

  const client = supabase.createClient(supabaseUrlInput.value.trim(), supabaseKeyInput.value.trim());
  const { error } = await client.from("words").select("id").limit(1);

  if (error) {
    state.db.connected = false;
    state.db.client = null;
    updateQuickStartCard();
    setDbStatus("Sync: Offline.");
    return;
  }

  state.db.client = client;
  state.db.connected = true;
  updateQuickStartCard();
  clearScopeError();
  await fetchChapters();
  await refreshPlayerStats();
  setDbStatus("Sync: Synced.");
  if (state.scope === "chapter" && state.selectedChapter) {
    await loadChapterMetadata(state.selectedChapter);
  }
}

function hasStoredDbConfig() {
  return Boolean(supabaseUrlInput?.value?.trim() && supabaseKeyInput?.value?.trim());
}

async function fetchChapters() {
  if (!state.db.connected) {
    return;
  }

  const { data, error } = await state.db.client.from("words").select("chapter").order("chapter", { ascending: true });
  if (error) {
    setSyncError(`Failed to load chapters: ${error.message}`);
    return;
  }

  const chapterCounts = new Map();
  (data || []).forEach((row) => {
    const chapter = normalizeChapter(row.chapter);
    chapterCounts.set(chapter, (chapterCounts.get(chapter) || 0) + 1);
  });

  state.chapterCatalog = [...chapterCounts.entries()]
    .map(([chapter, count]) => ({ chapter, count }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter, "en", { sensitivity: "base" }));

  populateChapterSelect(state.chapterCatalog);
  applyPracticeScope();
  persistChapterCacheToStorage();
}

function populateChapterSelect(catalog) {
  const previous = state.selectedChapter || "";
  chapterSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select chapter";
  chapterSelect.appendChild(placeholder);

  catalog.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.chapter;
    option.textContent = `${item.chapter} (${item.count})`;
    chapterSelect.appendChild(option);
  });

  const chapters = catalog.map((item) => item.chapter);
  chapterSelect.value = chapters.includes(previous) ? previous : "";
  state.selectedChapter = chapterSelect.value || "";
}

function resetChapterControls() {
  chapterSelect.innerHTML = '<option value="">Select chapter</option>';
  chapterSelect.value = "";
  chapterSelect.disabled = true;
  state.selectedChapter = "";
}

async function saveProgress(roundResult) {
  if (!state.db.connected || state.roundSaved || !state.pairs.length) {
    return;
  }

  const playerName = getPlayerName();
  if (!playerName) {
    setDbStatus("Progress not saved: enter player name.", true);
    return;
  }

  const sessionPayload = {
    user_name: playerName,
    chapter: state.currentChapter,
    mode: state.mode,
    timed: state.timed,
    round_result: roundResult,
    words_in_round: state.pairs.length,
    correct_count: state.correct,
    attempts_count: state.attempts,
    source: state.source,
  };

  const { data: sessionRow, error: sessionError } = await state.db.client
    .from("progress_sessions")
    .insert(sessionPayload)
    .select("id")
    .single();

  if (sessionError) {
    setDbStatus(`Progress save failed: ${sessionError.message}`, true);
    return;
  }

  const detailRows = [...state.wordStats.values()]
    .filter((row) => row.attempts > 0 || row.correct > 0)
    .map((row) => ({
      progress_session_id: sessionRow.id,
      word_id: row.wordId,
      chapter: row.chapter,
      finnish: row.finnish,
      english: row.english,
      attempts: row.attempts,
      correct: row.correct,
    }));

  if (detailRows.length > 0) {
    const { error: detailError } = await state.db.client.from("progress_word_stats").insert(detailRows);
    if (detailError) {
      setDbStatus(`Word progress save failed: ${detailError.message}`, true);
      return;
    }
  }

  const userStatsSaved = await updateUserStats(playerName, state.correct, state.attempts);
  if (!userStatsSaved) {
    return;
  }

  state.roundSaved = true;
  await refreshPlayerStats();
  setDbStatus("Progress saved.");
}

async function updateUserStats(playerName, correctDelta, attemptsDelta) {
  const { data: currentStats, error: loadError } = await state.db.client
    .from("user_stats")
    .select("times_played, correct_guesses, total_attempts")
    .eq("user_name", playerName)
    .maybeSingle();

  if (loadError && loadError.code !== "PGRST116") {
    setDbStatus(`Could not update user stats: ${loadError.message}`, true);
    return false;
  }

  const timesPlayed = (currentStats?.times_played ?? 0) + 1;
  const correctGuesses = (currentStats?.correct_guesses ?? 0) + correctDelta;
  const totalAttempts = (currentStats?.total_attempts ?? 0) + attemptsDelta;

  const { error: upsertError } = await state.db.client.from("user_stats").upsert(
    {
      user_name: playerName,
      times_played: timesPlayed,
      correct_guesses: correctGuesses,
      total_attempts: totalAttempts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_name" },
  );

  if (upsertError) {
    setDbStatus(`Could not save user stats: ${upsertError.message}`, true);
    return false;
  }

  return true;
}

async function refreshPlayerStats() {
  if (!state.db.connected) {
    dbStatsText.textContent = "Player stats: -";
    return;
  }

  const playerName = getPlayerName();
  if (!playerName) {
    dbStatsText.textContent = "Player stats: enter player name.";
    return;
  }

  const { data, error } = await state.db.client
    .from("user_stats")
    .select("times_played, correct_guesses, total_attempts")
    .eq("user_name", playerName)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    dbStatsText.textContent = "Player stats: unavailable.";
    setDbStatus(`Could not load player stats: ${error.message}`, true);
    return;
  }

  const plays = data?.times_played ?? 0;
  const correct = data?.correct_guesses ?? 0;
  const attempts = data?.total_attempts ?? 0;
  dbStatsText.textContent = `Player stats (${playerName}): ${plays} plays, ${correct} correct, ${attempts} attempts`;
}

function getPlayerName() {
  return String(playerNameInput?.value || "").trim();
}

function persistDbConfigToStorage() {
  if (!supabaseUrlInput || !supabaseKeyInput || !playerNameInput) {
    return;
  }

  try {
    const payload = {
      url: supabaseUrlInput.value.trim(),
      anonKey: supabaseKeyInput.value.trim(),
      playerName: getPlayerName(),
    };
    localStorage.setItem(DB_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

function hydrateDbConfigFromStorage() {
  if (!supabaseUrlInput || !supabaseKeyInput || !playerNameInput) {
    return;
  }

  try {
    const raw = localStorage.getItem(DB_CONFIG_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed.url) {
      supabaseUrlInput.value = parsed.url;
    }
    if (parsed.anonKey) {
      supabaseKeyInput.value = parsed.anonKey;
    }
    if (parsed.playerName) {
      playerNameInput.value = parsed.playerName;
    }
  } catch {
    // Ignore invalid JSON or unavailable storage.
  }
}

function persistPracticePrefsToStorage() {
  try {
    const payload = {
      scope: state.scope,
      chapter: state.selectedChapter,
    };
    localStorage.setItem(PRACTICE_PREF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

function hydratePracticePrefsFromStorage() {
  try {
    const raw = localStorage.getItem(PRACTICE_PREF_STORAGE_KEY);
    if (!raw) {
      state.scope = "all";
      state.selectedChapter = "";
      return;
    }

    const parsed = JSON.parse(raw);
    state.scope = parsed.scope === "chapter" ? "chapter" : "all";
    state.selectedChapter = String(parsed.chapter || "");
  } catch {
    state.scope = "all";
    state.selectedChapter = "";
  }
}

function persistChapterCacheToStorage() {
  try {
    localStorage.setItem(CHAPTER_CACHE_STORAGE_KEY, JSON.stringify(state.chapterCatalog));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

function hydrateChapterCacheFromStorage() {
  try {
    const raw = localStorage.getItem(CHAPTER_CACHE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }

    state.chapterCatalog = parsed
      .map((row) => ({
        chapter: normalizeChapter(row.chapter),
        count: Number(row.count) || 0,
      }))
      .filter((row) => row.chapter);

    if (state.chapterCatalog.length > 0) {
      populateChapterSelect(state.chapterCatalog);
    }
  } catch {
    // Ignore invalid JSON or unavailable storage.
  }
}

function normalize(text) {
  return String(text).trim().toLowerCase();
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  return items;
}
