const DEFAULT_CHAPTER = "General";
const DB_CONFIG_STORAGE_KEY = "finnish_trainer_supabase_config_v1";

const fileInput = document.getElementById("fileInput");
const timedToggle = document.getElementById("timedToggle");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const importPrimaryBtn = document.getElementById("importPrimaryBtn");
const continueBtn = document.getElementById("continueBtn");
const startBtn = document.getElementById("startBtn");
const sampleBtn = document.getElementById("sampleBtn");
const syncNowBtn = document.getElementById("syncNowBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const miniSettingsBtn = document.getElementById("miniSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const checkWriteBtn = document.getElementById("checkWriteBtn");
const flashSubmitBtn = document.getElementById("flashSubmitBtn");
const flashSkipBtn = document.getElementById("flashSkipBtn");
const flashInput = document.getElementById("flashInput");
const fileInlineError = document.getElementById("fileInlineError");
const chapterInlineError = document.getElementById("chapterInlineError");
const syncInlineError = document.getElementById("syncInlineError");
const readySummaryText = document.getElementById("readySummaryText");
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
const stepItems = [...document.querySelectorAll(".step")];
const stepPanels = [...document.querySelectorAll(".step-panel")];

const supabaseUrlInput = document.getElementById("supabaseUrlInput");
const supabaseKeyInput = document.getElementById("supabaseKeyInput");
const playerNameInput = document.getElementById("playerNameInput");
const connectDbBtn = document.getElementById("connectDbBtn");
const saveWordsBtn = document.getElementById("syncNowBtn");
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
  currentChapter: "Mixed",
  source: "local",
  datasetLabel: "-",
  chapterPool: [],
  chapterLoadSource: "none",
  roundStarted: false,
  uiStep: 1,
  roundSaved: false,
  db: {
    client: null,
    connected: false,
  },
};

importPrimaryBtn.addEventListener("click", loadFromFile);
sampleBtn.addEventListener("click", loadSampleData);
continueBtn.addEventListener("click", () => setStep(3));
startBtn.addEventListener("click", startPractice);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => onModeChange(button.dataset.mode));
});
stepItems.forEach((item) => {
  item.addEventListener("click", () => onStepSelect(Number(item.dataset.step)));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onStepSelect(Number(item.dataset.step));
    }
  });
});
timedToggle.addEventListener("change", onTimedToggle);
chapterSelect.addEventListener("change", handleChapterLoad);
checkWriteBtn.addEventListener("click", () => submitWriteAnswers(false));
flashSubmitBtn.addEventListener("click", submitFlashAnswer);
flashSkipBtn.addEventListener("click", skipFlashCard);
flashInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitFlashAnswer();
  }
});
connectDbBtn.addEventListener("click", connectToSupabase);
saveWordsBtn.addEventListener("click", saveCurrentWordsToDb);
openSettingsBtn.addEventListener("click", openSettingsModal);
miniSettingsBtn.addEventListener("click", openSettingsModal);
closeSettingsBtn.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettingsModal();
  }
});
playerNameInput.addEventListener("change", () => {
  persistDbConfigToStorage();
  if (state.db.connected) {
    void refreshPlayerStats();
  }
});
window.addEventListener("resize", syncAllLines);

hydrateDbConfigFromStorage();
resetChapterControls();
updateSaveButtonState();
setStep(1);
setStatus("Import a word set to begin.");
setDbStatus("Sync: Not connected.");
updateScore();
updateTimerDisplay();
updateReadySummary();
updateMiniBar();

async function loadFromFile() {
  clearFileError();
  const file = fileInput.files?.[0];

  if (!file) {
    setFileError("Choose an Excel or CSV file first.");
    return;
  }

  if (typeof XLSX === "undefined") {
    setFileError("Excel parser did not load. Check your internet connection and refresh.");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const pairs = parsePairsFromWorkbook(buffer);
    state.datasetLabel = file.name;
    setPairsAndStart(pairs, { source: "file" });
    setStep(2);
    updateReadySummary();

    const chapterCount = new Set(pairs.map((pair) => pair.chapter)).size;
    setStatus(`Loaded ${pairs.length} words from ${file.name} (${chapterCount} chapters).`);
  } catch (error) {
    setFileError(error.message || "Could not read that file.");
  }
}

function loadSampleData() {
  clearFileError();
  const samplePairs = [
    { finnish: "kissa", english: "cat", chapter: "Animals" },
    { finnish: "koira", english: "dog", chapter: "Animals" },
    { finnish: "vesi", english: "water", chapter: "Nature" },
    { finnish: "koulu", english: "school", chapter: "Daily life" },
    { finnish: "koti", english: "home", chapter: "Daily life" },
    { finnish: "aurinko", english: "sun", chapter: "Nature" },
    { finnish: "sydan", english: "heart", chapter: "Health" },
    { finnish: "kirja", english: "book", chapter: "Daily life" },
  ];

  state.datasetLabel = "Sample set";
  setPairsAndStart(samplePairs, { source: "sample" });
  setStep(2);
  updateReadySummary();
  setStatus("Loaded sample words.");
}

function onStepSelect(stepNumber) {
  if (stepNumber === 1) {
    setStep(1);
    return;
  }

  if (!state.rawPairs.length) {
    setStep(1);
    setFileError("Import a word set first.");
    return;
  }

  setStep(stepNumber === 2 ? 2 : 3);
}

function startPractice() {
  clearChapterError();
  if (!state.rawPairs.length) {
    setFileError("Import a word set first.");
    return;
  }

  state.roundStarted = true;
  setStep(3);
  gameplayArea.classList.remove("hidden");
  miniBar.classList.remove("hidden");
  startRound();
  updateMiniBar();
  setStatus("Round started.");
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

function setPairsAndStart(rawPairs, options = {}) {
  const cleanedPairs = rawPairs
    .map((pair) => ({
      wordId: pair.wordId ?? pair.id ?? null,
      finnish: String(pair.finnish ?? "").trim(),
      english: String(pair.english ?? "").trim(),
      chapter: normalizeChapter(pair.chapter),
    }))
    .filter((pair) => pair.finnish && pair.english);

  if (cleanedPairs.length < 2) {
    setFileError("Need at least 2 valid word rows.");
    return;
  }

  const chapterLoadSource =
    options.chapterLoadSource || (options.source === "database" ? "database" : "local");
  const chapterPool = options.chapterPool || cleanedPairs;

  state.rawPairs = cleanedPairs;
  state.source = options.source || "local";
  state.currentChapter = options.chapterLabel || deriveChapterLabel(cleanedPairs);
  state.chapterPool = chapterPool;
  updateSaveButtonState();

  if (chapterLoadSource === "local") {
    const localChapters = getChaptersFromPairs(chapterPool);
    populateChapterSelect(localChapters, "local");
  } else {
    state.chapterLoadSource = "database";
  }

  if (state.roundStarted) {
    startRound();
  }
  updateReadySummary();
  updateMiniBar();
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
  dbStatusText.classList.toggle("error", false);
  if (isError) {
    setSyncError(message);
  }
}

function setStep(stepNumber) {
  state.uiStep = stepNumber;
  stepItems.forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.step) === stepNumber);
  });
  stepPanels.forEach((panel, index) => {
    panel.classList.toggle("hidden", index + 1 !== stepNumber);
  });
}

function updateReadySummary() {
  if (!readySummaryText) {
    return;
  }

  if (!state.rawPairs.length) {
    readySummaryText.textContent = "Import a dataset first.";
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

function setFileError(message) {
  if (!fileInlineError) {
    return;
  }
  fileInlineError.textContent = message;
  fileInlineError.classList.remove("hidden");
}

function clearFileError() {
  if (!fileInlineError) {
    return;
  }
  fileInlineError.textContent = "";
  fileInlineError.classList.add("hidden");
}

function setChapterError(message) {
  if (!chapterInlineError) {
    return;
  }
  chapterInlineError.textContent = message;
  chapterInlineError.classList.remove("hidden");
}

function clearChapterError() {
  if (!chapterInlineError) {
    return;
  }
  chapterInlineError.textContent = "";
  chapterInlineError.classList.add("hidden");
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

function deriveChapterLabel(pairs) {
  const chapters = [...new Set(pairs.map((pair) => normalizeChapter(pair.chapter)))];
  if (chapters.length === 1) {
    return chapters[0];
  }
  return "Mixed";
}

function getChaptersFromPairs(pairs) {
  return [...new Set((pairs || []).map((pair) => normalizeChapter(pair.chapter)))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
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
  const playerName = getPlayerName();

  if (!url || !anonKey) {
    setSyncError("Enter Supabase URL and Access key in Advanced.");
    return;
  }

  if (!playerName) {
    setSyncError("Enter player name first.");
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
    return;
  }

  state.db.client = client;
  state.db.connected = true;
  persistDbConfigToStorage();
  updateSaveButtonState();

  await fetchChapters();
  await refreshPlayerStats();
  setDbStatus("Sync connected.");
  closeSettingsModal();
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

  const unique = [...new Set((data || []).map((row) => normalizeChapter(row.chapter)))];
  if (state.chapterLoadSource !== "local" || !state.chapterPool.length) {
    populateChapterSelect(unique, "database");
  }
}

function populateChapterSelect(chapters, source) {
  const previous = chapterSelect.value || "__all__";
  chapterSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "__all__";
  allOption.textContent = "All chapters";
  chapterSelect.appendChild(allOption);

  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter;
    chapterSelect.appendChild(option);
  });

  state.chapterLoadSource = source || state.chapterLoadSource || "none";
  chapterSelect.value = chapters.includes(previous) || previous === "__all__" ? previous : "__all__";
  chapterSelect.disabled = chapters.length === 0 && !state.chapterPool.length;
}

function resetChapterControls() {
  chapterSelect.innerHTML = '<option value="__all__">All chapters</option>';
  chapterSelect.value = "__all__";
  chapterSelect.disabled = true;
  state.chapterLoadSource = "none";
}

function handleChapterLoad() {
  if (state.chapterLoadSource === "local") {
    loadLocalChapterWords();
    return;
  }

  void loadChapterWordsFromDb();
}

function loadLocalChapterWords() {
  clearChapterError();
  const selectedChapter = chapterSelect.value || "__all__";
  if (!state.chapterPool.length) {
    setChapterError("No imported words available for chapter filtering.");
    return;
  }

  const filtered =
    selectedChapter === "__all__"
      ? [...state.chapterPool]
      : state.chapterPool.filter((pair) => normalizeChapter(pair.chapter) === selectedChapter);

  if (filtered.length < 2) {
    setChapterError("Selected chapter has too few words (need at least 2).");
    return;
  }

  const chapterLabel = selectedChapter === "__all__" ? "All chapters" : selectedChapter;
  setPairsAndStart(filtered, {
    source: state.source,
    chapterLabel,
    chapterLoadSource: "local",
    chapterPool: state.chapterPool,
  });
  setStatus(`Loaded ${filtered.length} words from ${chapterLabel}.`);
}

async function loadChapterWordsFromDb() {
  clearChapterError();
  if (!state.db.connected) {
    setChapterError("Connect Sync in Settings first.");
    return;
  }

  const selectedChapter = chapterSelect.value || "__all__";
  let query = state.db.client
    .from("words")
    .select("id, chapter, finnish, english")
    .order("chapter", { ascending: true })
    .order("finnish", { ascending: true });

  if (selectedChapter !== "__all__") {
    query = query.eq("chapter", selectedChapter);
  }

  const { data, error } = await query;
  if (error) {
    setChapterError(`Could not load chapter: ${error.message}`);
    return;
  }

  if (!data || data.length < 2) {
    setChapterError("Selected chapter has too few words (need at least 2).");
    return;
  }

  const pairs = data.map((row) => ({
    wordId: row.id,
    chapter: normalizeChapter(row.chapter),
    finnish: row.finnish,
    english: row.english,
  }));

  const chapterLabel = selectedChapter === "__all__" ? "All chapters" : selectedChapter;
  setPairsAndStart(pairs, { source: "database", chapterLabel, chapterLoadSource: "database" });
  setStatus(`Loaded ${pairs.length} words from ${chapterLabel}.`);
}

async function saveCurrentWordsToDb() {
  clearSyncError();
  if (!state.rawPairs.length) {
    setFileError("Import words first.");
    return;
  }

  if (!state.db.connected) {
    openSettingsModal();
    setSyncError("Connect Sync first.");
    return;
  }

  const rows = state.rawPairs.map((pair) => ({
    chapter: normalizeChapter(pair.chapter),
    finnish: pair.finnish,
    english: pair.english,
  }));

  const { error } = await state.db.client
    .from("words")
    .upsert(rows, { onConflict: "chapter,finnish,english", ignoreDuplicates: true });

  if (error) {
    setSyncError(`Sync failed: ${error.message}`);
    return;
  }

  await fetchChapters();
  setDbStatus(`Synced ${rows.length} words.`);
}

function updateSaveButtonState() {
  const hasWords = state.rawPairs.length > 0;
  const canSync = hasWords && state.db.connected;
  saveWordsBtn.disabled = !canSync;
  saveWordsBtn.title = canSync ? "" : "Connect Sync in Settings and import words first";
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
  return String(playerNameInput.value || "").trim();
}

function persistDbConfigToStorage() {
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

function parsePairsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("No worksheet found in that file.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!rows.length) {
    throw new Error("The first sheet is empty.");
  }

  const startIndex = looksLikeHeader(rows[0]) ? 1 : 0;
  const pairs = [];

  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const finnish = String(row[0] ?? "").trim();
    const english = String(row[1] ?? "").trim();
    const chapter = normalizeChapter(row[2]);

    if (finnish && english) {
      pairs.push({ finnish, english, chapter });
    }
  }

  if (pairs.length < 2) {
    throw new Error("Need at least 2 valid rows in columns A and B.");
  }

  return pairs;
}

function looksLikeHeader(row) {
  const first = String(row[0] ?? "").toLowerCase();
  const second = String(row[1] ?? "").toLowerCase();

  const leftHeader = ["finnish", "suomi", "finnish word", "finnish words"];
  const rightHeader = ["english", "translation", "english word", "english words"];

  return leftHeader.some((text) => first.includes(text)) && rightHeader.some((text) => second.includes(text));
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
