const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const LEVELS = [
  { id: 1, short: "LEVEL 1", name: "くり上がりなし", description: "2けた ＋ 2けた\nくり上がり なし", example: "34＋25", kind: "two-no-carry" },
  { id: 2, short: "LEVEL 2", name: "一のくらいでくり上がり", description: "2けた ＋ 2けた\nくり上がり 1回", example: "27＋18", kind: "two-carry-ones" },
  { id: 3, short: "LEVEL 3", name: "二回のくり上がり", description: "2けた ＋ 2けた\nくり上がり 2回", example: "68＋57", kind: "two-carry-twice" },
  { id: 4, short: "LEVEL 4", name: "3けたの筆算", description: "3けた ＋ 3けた\nくらいをそろえて計算", example: "246＋137", kind: "three-digit" }
];

const SESSION_SIZE = 10;
const STORAGE_KEY = "tashizanHissanRecord.v1";

const state = {
  level: null,
  problem: null,
  questionIndex: 0,
  sessionCorrect: 0,
  totalCorrect: Number(localStorage.getItem(STORAGE_KEY) || 0),
  boardCells: [],
  steps: [],
  stepIndex: 0,
  input: ""
};

const homeScreen = $("#homeScreen");
const gameScreen = $("#gameScreen");
const levelGrid = $("#levelGrid");
const board = $("#board");
const boardWrap = $("#boardWrap");
const hintBox = $("#hintBox");

function showScreen(screen) {
  $$(".screen").forEach(el => el.classList.remove("active"));
  screen.classList.add("active");
}

function renderHome() {
  $("#homeCorrect").textContent = String(state.totalCorrect);
  levelGrid.innerHTML = LEVELS.map(level => {
    return '<button class="level-card" type="button" data-level="' + level.id + '">' +
      '<div><div class="num">' + level.short + '</div>' +
      '<div class="name">' + level.name + '</div>' +
      '<div class="desc">' + level.description.replaceAll("\n", "<br>") + '</div></div>' +
      '<div class="example">' + level.example + '</div></button>';
  }).join("");

  $$(".level-card", levelGrid).forEach(button => {
    button.addEventListener("click", () => startLevel(Number(button.dataset.level)));
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(levelId) {
  const level = LEVELS.find(item => item.id === levelId);
  if (!level) throw new Error("Unknown level");

  if (level.kind === "two-no-carry") {
    let a, b;
    do {
      a = randomInt(10, 99);
      b = randomInt(10, 99);
    } while ((a % 10) + (b % 10) >= 10 || Math.floor(a / 10) + Math.floor(b / 10) >= 10);
    return { a, b };
  }

  if (level.kind === "two-carry-ones") {
    let a, b;
    do {
      a = randomInt(10, 99);
      b = randomInt(10, 99);
    } while (
      (a % 10) + (b % 10) < 10 ||
      Math.floor(a / 10) + Math.floor(b / 10) >= 10
    );
    return { a, b };
  }

  if (level.kind === "two-carry-twice") {
    let a, b;
    do {
      a = randomInt(10, 99);
      b = randomInt(10, 99);
    } while (
      (a % 10) + (b % 10) < 10 ||
      Math.floor(a / 10) + Math.floor(b / 10) + 1 < 10
    );
    return { a, b };
  }

  return { a: randomInt(100, 999), b: randomInt(100, 999) };
}

function createProblemModel(a, b) {
  const aDigits = String(a).split("").map(Number);
  const bDigits = String(b).split("").map(Number);
  const maxDigits = Math.max(aDigits.length, bDigits.length);
  const cols = maxDigits + 1;
  const startCol = cols - maxDigits;
  const aFull = Array(cols).fill(0);
  const bFull = Array(cols).fill(0);

  aDigits.forEach((digit, index) => {
    aFull[cols - aDigits.length + index] = digit;
  });
  bDigits.forEach((digit, index) => {
    bFull[cols - bDigits.length + index] = digit;
  });

  const columns = [];
  let carry = 0;

  for (let col = cols - 1; col >= startCol; col -= 1) {
    const aDigit = aFull[col];
    const bDigit = bFull[col];
    const carryIn = carry;
    const sum = aDigit + bDigit + carryIn;

    columns[col] = {
      col,
      placeIndex: cols - 1 - col,
      aDigit,
      bDigit,
      carryIn,
      resultDigit: sum % 10,
      carryOut: Math.floor(sum / 10)
    };
    carry = Math.floor(sum / 10);
  }

  return { a, b, sum: a + b, cols, maxDigits, startCol, aFull, bFull, columns };
}

function buildSteps(model) {
  const steps = [];

  for (let col = model.cols - 1; col >= model.startCol; col -= 1) {
    const data = model.columns[col];
    const place = placeName(data.placeIndex);
    const expression = data.carryIn > 0
      ? String(data.aDigit) + "＋" + String(data.bDigit) + "＋1"
      : String(data.aDigit) + "＋" + String(data.bDigit);

    steps.push({
      kind: "carry-check",
      col,
      title: place + "の くり上がりは？",
      text: data.carryIn > 0
        ? "まず、このくらいをたして、くり上がりがあるか考えよう。"
        : "まず、このくらいをたして、くり上がりがあるか考えよう。",
      expression,
      answer: data.carryOut > 0 ? "yes" : "no"
    });

    steps.push({
      kind: "sum-input",
      col,
      title: place + "の答えは？",
      text: data.carryOut > 0
        ? "10以上になったら、答えを2けたで入力しよう。"
        : "計算した答えを入力しよう。",
      expression,
      answer: data.carryOut > 0
        ? String(data.aDigit + data.bDigit + data.carryIn)
        : String(data.resultDigit),
      requiresCarry: data.carryOut > 0,
      carryOut: data.carryOut,
      targetCol: col - 1
    });
  }

  steps.push({
    kind: "finish",
    title: "筆算のできあがり",
    text: "右から順に、たして、くり上がりを考えて、答えを書くことができました。"
  });

  return steps;
}

function placeName(index) {
  return ["一のくらい", "十のくらい", "百のくらい", "千のくらい"][index] || "このくらい";
}

function renderBoard(model) {
  board.style.setProperty("--cell", getCellSize(model.cols));
  board.style.gridTemplateColumns = "repeat(" + model.cols + ", var(--cell))";
  board.innerHTML = "";
  state.boardCells = [];

  function createRow(className, rowIndex) {
    for (let col = 0; col < model.cols; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell " + className + (col === model.cols - 1 ? " last-col" : "");
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(col);
      cell.setAttribute("role", "gridcell");
      board.appendChild(cell);
      state.boardCells.push(cell);
    }
  }

  createRow("carry", 0);
  createRow("operand", 1);
  createRow("operand", 2);
  createRow("result", 3);

  const aText = String(model.a);
  const bText = String(model.b);

  for (let i = 0; i < aText.length; i += 1) {
    const col = model.cols - aText.length + i;
    getCell(1, col).textContent = aText[i];
  }

  for (let i = 0; i < bText.length; i += 1) {
    const col = model.cols - bText.length + i;
    getCell(2, col).textContent = bText[i];
  }

  const plusCol = model.cols - bText.length - 1;
  if (plusCol >= 0) getCell(2, plusCol).classList.add("plus");

  updateBoardVisuals();
}

function getCell(row, col) {
  return state.boardCells.find(cell =>
    cell.dataset.row === String(row) && cell.dataset.col === String(col)
  );
}

function getCellSize(cols) {
  if (window.innerWidth <= 600) {
    return cols >= 4
      ? "clamp(58px,18vw,74px)"
      : "clamp(64px,20vw,84px)";
  }
  return cols >= 4
    ? "clamp(64px,10vw,88px)"
    : "clamp(72px,11vw,96px)";
}

function updateBoardVisuals() {
  $(".cell", board).forEach(cell => cell.classList.remove("focus", "done", "wrong"));

  const current = state.steps[state.stepIndex];
  if (!current) return;

  if (current.kind === "carry-check" || current.kind === "sum-input") {
    getCell(1, current.col)?.classList.add("focus");
    getCell(2, current.col)?.classList.add("focus");
    getCell(3, current.col)?.classList.add("focus");
    if (current.carryOut > 0 || current.kind === "carry-check") {
      getCell(0, current.col)?.classList.add("focus");
    }
    if (current.kind === "sum-input" && current.requiresCarry && current.targetCol >= 0) {
      getCell(0, current.targetCol)?.classList.add("focus");
    }
  }

  for (let col = modelStartCol(); col < state.problem.cols; col += 1) {
    if (hasCompletedColumn(col)) getCell(3, col)?.classList.add("done");
  }

  updateColumnGuide();
}

function modelStartCol() {
  return state.problem.startCol;
}

function hasCompletedColumn(col) {
  return state.steps.slice(0, state.stepIndex).some(step =>
    step.kind === "sum-input" && step.col === col
  );
}

function updateColumnGuide() {
  const guide = $(".column-guide", boardWrap);
  const current = state.steps[state.stepIndex];

  if (!guide || !current || current.kind === "finish") {
    if (guide) guide.style.display = "none";
    return;
  }

  const col = current.kind === "sum-input" && current.requiresCarry && current.targetCol >= 0
    ? current.targetCol
    : current.col;

  const cell = getCell(0, col);
  if (!cell) return;

  const cellRect = cell.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  guide.style.display = "block";
  guide.style.setProperty("--guide-left", (cellRect.left - boardRect.left + cellRect.width / 2) + "px");
  guide.style.setProperty("--guide-height", cellRect.height + "px");
}

function updateStepRail() {
  const current = state.steps[state.stepIndex];
  const pills = $(".step-pill");
  pills.forEach(pill => pill.classList.remove("active", "done"));

  if (!current) return;

  if (current.kind === "carry-check") {
    pills[0]?.classList.add("done");
    pills[1]?.classList.add("active");
  } else if (current.kind === "sum-input") {
    pills[0]?.classList.add("done");
    pills[1]?.classList.add("done");
    pills[2]?.classList.add("active");
  } else {
    pills.forEach(pill => pill.classList.add("done"));
  }
}

function renderCurrentStep() {
  const step = state.steps[state.stepIndex];
  if (!step) return;

  $("#instructionTitle").textContent = step.title;
  $("#instructionText").textContent = step.text;

  const prompt = $("#calculationPrompt");
  const feedback = $("#feedback");

  feedback.textContent = "";
  feedback.className = "feedback neutral";

  if (step.kind === "finish") {
    prompt.textContent =
      String(state.problem.a) + "＋" + String(state.problem.b) + "＝" + String(state.problem.sum);
    $("#answerDisplay").textContent = "✓";
    $("#answerDisplay").style.borderColor = "#67b78d";
    $("#answerDisplay").style.background = "#effaf4";
  } else if (step.kind === "carry-check") {
    prompt.textContent = step.expression;
    $("#answerDisplay").textContent = "ある？ なし？";
    $("#answerDisplay").style.borderColor = "";
    $("#answerDisplay").style.background = "";
  } else {
    prompt.textContent = step.expression + "＝";
    $("#answerDisplay").textContent = state.input || "＿";
    $("#answerDisplay").style.borderColor = "";
    $("#answerDisplay").style.background = "";
  }

  updateStepRail();
  updateBoardVisuals();
  renderKeypad();
}

function renderKeypad() {
  const step = state.steps[state.stepIndex];
  const pad = $("#numberPad");

  if (!step || step.kind === "finish") {
    pad.innerHTML = "";
    return;
  }

  if (step.kind === "carry-check") {
    pad.innerHTML =
      '<button type="button" class="choice-button carry-yes" data-choice="yes">ある</button>' +
      '<button type="button" class="choice-button carry-no" data-choice="no">なし</button>';
    return;
  }

  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","決定"];
  pad.innerHTML = keys.map(key => {
    const cls = key === "決定" ? "submit" : key === "⌫" ? "function" : "";
    return '<button type="button" class="pad-button ' + cls + '" data-key="' + key + '">' + key + '</button>';
  }).join("");
}

function setFeedback(message, type) {
  const feedback = $("#feedback");
  feedback.textContent = message;
  feedback.className = "feedback " + type;
}

function handlePadKey(key) {
  const step = state.steps[state.stepIndex];
  if (!step || step.kind === "finish" || step.kind === "carry-check") return;

  if (key === "⌫") {
    state.input = "";
    renderCurrentStep();
    return;
  }

  if (key === "決定") {
    checkInput();
    return;
  }

  const maxLength = step.requiresCarry ? 2 : 1;
  if (/^\d$/.test(key) && state.input.length < maxLength) {
    state.input += key;
    renderCurrentStep();
  }
}

function handleCarryChoice(choice) {
  const step = state.steps[state.stepIndex];
  if (!step || step.kind !== "carry-check") return;

  if (choice !== step.answer) {
    setFeedback(
      choice === "yes"
        ? "10以上になるか、もう一度たしてみよう。"
        : "10以上になるか、数字をもう一度見てみよう。",
      "bad"
    );
    markCurrentCellWrong();
    return;
  }

  setFeedback(
    choice === "yes"
      ? "くり上がりあり。答えを2けたで入力しよう。"
      : "くり上がりなし。答えを入力しよう。",
    "good"
  );

  window.setTimeout(() => {
    state.stepIndex += 1;
    state.input = "";
    renderCurrentStep();
  }, 300);
}

function checkInput() {
  const step = state.steps[state.stepIndex];
  if (!step || step.kind !== "sum-input") return;

  if (state.input !== step.answer) {
    setFeedback(
      step.requiresCarry
        ? "10以上になるときは、答えを2けたで入力します。"
        : "たす数字をもう一度見てみよう。",
      "bad"
    );
    markCurrentCellWrong();
    return;
  }

  if (step.requiresCarry) {
    const full = Number(state.input);
    const resultDigit = full % 10;
    const carryDigit = Math.floor(full / 10);

    if (carryDigit > 0) {
      if (step.targetCol >= 0) {
        if (step.col > state.problem.startCol) {
          getCell(0, step.targetCol).textContent = String(carryDigit);
        } else {
          getCell(3, step.targetCol).textContent = String(carryDigit);
        }
      }
    }
    getCell(3, step.col).textContent = String(resultDigit);

    setFeedback(
      String(full) + "。 " +
      String(carryDigit) + "をくり上げて、" +
      String(resultDigit) + "を答えのくらいに書きました。",
      "good"
    );
  } else {
    getCell(3, step.col).textContent = step.answer;
    setFeedback("正解。次のくらいへ進もう。", "good");
  }

  state.input = "";

  window.setTimeout(() => {
    state.stepIndex += 1;
    if (state.steps[state.stepIndex]?.kind === "finish") {
      completeProblem();
    } else {
      renderCurrentStep();
    }
  }, 500);
}

function markCurrentCellWrong() {
  const step = state.steps[state.stepIndex];
  if (!step) return;

  const cells = [];

  if (step.kind === "carry-check" || step.kind === "sum-input") {
    cells.push(getCell(0, step.col), getCell(1, step.col), getCell(2, step.col), getCell(3, step.col));
    if (step.kind === "sum-input" && step.targetCol >= 0) {
      cells.push(getCell(0, step.targetCol), getCell(3, step.targetCol));
    }
  }

  cells.filter(Boolean).forEach(cell => {
    cell.classList.remove("wrong");
    void cell.offsetWidth;
    cell.classList.add("wrong");
  });
}

function completeProblem() {
  const model = state.problem;

  state.sessionCorrect += 1;
  state.totalCorrect += 1;
  localStorage.setItem(STORAGE_KEY, String(state.totalCorrect));

  $$(".cell.result", board).forEach(cell => cell.classList.add("done"));
  renderHome();

  const overlay = $("#completeOverlay");
  $("#completeTitle").textContent = String(model.a) + "＋" + String(model.b) + "＝" + String(model.sum);
  $("#completeText").textContent =
    "右のくらいから順に、筆算を完成させました。\n今回の正解：" + state.sessionCorrect + "問";
  $("#nextButton").textContent =
    state.questionIndex + 1 < SESSION_SIZE ? "つぎの問題" : "レベルをクリア";
  overlay.hidden = false;

  $("#questionProgress").textContent = (state.questionIndex + 1) + " / " + SESSION_SIZE;
  $("#sessionCorrect").textContent = "正解 " + state.sessionCorrect;
}

function startLevel(levelId) {
  const level = LEVELS.find(item => item.id === levelId);
  if (!level) return;

  state.level = level;
  state.questionIndex = 0;
  state.sessionCorrect = 0;
  showScreen(gameScreen);
  startQuestion();
}

function startQuestion() {
  $("#completeOverlay").hidden = true;
  $("#gameLevelLabel").textContent = state.level.short;
  $("#gameTitle").textContent = state.level.name;
  $("#questionProgress").textContent = (state.questionIndex + 1) + " / " + SESSION_SIZE;
  $("#sessionCorrect").textContent = "正解 " + state.sessionCorrect;

  const raw = generateProblem(state.level.id);
  state.problem = createProblemModel(raw.a, raw.b);
  state.steps = buildSteps(state.problem);
  state.stepIndex = 0;
  state.input = "";

  $("#problemExpression").textContent = String(raw.a) + "＋" + String(raw.b) + "＝";
  hintBox.hidden = true;

  renderBoard(state.problem);
  renderCurrentStep();
}

function nextQuestion() {
  $("#completeOverlay").hidden = true;

  if (state.questionIndex + 1 >= SESSION_SIZE) {
    finishLevel();
    return;
  }

  state.questionIndex += 1;
  startQuestion();
}

function finishLevel() {
  $("#completeOverlay").hidden = true;
  showScreen(homeScreen);
  renderHome();
}

function retryProblem() {
  const current = state.problem;
  state.problem = createProblemModel(current.a, current.b);
  state.steps = buildSteps(state.problem);
  state.stepIndex = 0;
  state.input = "";
  $("#completeOverlay").hidden = true;
  hintBox.hidden = true;
  renderBoard(state.problem);
  renderCurrentStep();
}

function showHint() {
  const step = state.steps[state.stepIndex];
  if (!step || step.kind === "finish") return;

  let message = "";

  if (step.kind === "carry-check") {
    message = "くらいの数字をたしてみよう。10以上になったら「ある」です。";
  } else if (step.kind === "sum-input" && step.requiresCarry) {
    message = "10以上になったときは、答えを2けたで入力します。たとえば 9＋4 なら 13 です。";
  } else {
    message = "右のくらいから計算します。今光っているくらいの答えを入力します。";
  }

  hintBox.textContent = message;
  hintBox.hidden = false;
  window.clearTimeout(showHint.timer);
  showHint.timer = window.setTimeout(() => {
    hintBox.hidden = true;
  }, 4500);
}

$("#numberPad").addEventListener("click", event => {
  const choice = event.target.closest("[data-choice]");
  if (choice) {
    handleCarryChoice(choice.dataset.choice);
    return;
  }

  const button = event.target.closest("[data-key]");
  if (button) handlePadKey(button.dataset.key);
});

$("#homeButton").addEventListener("click", () => {
  showScreen(homeScreen);
  renderHome();
});

$("#retryButton").addEventListener("click", retryProblem);
$("#hintButton").addEventListener("click", showHint);
$("#nextButton").addEventListener("click", nextQuestion);
$("#finishButton").addEventListener("click", finishLevel);

window.addEventListener("keydown", event => {
  if (!gameScreen.classList.contains("active")) return;
  if (event.key >= "0" && event.key <= "9") handlePadKey(event.key);
  if (event.key === "Backspace") handlePadKey("⌫");
  if (event.key === "Enter") handlePadKey("決定");
  if (event.key === "Escape") hintBox.hidden = true;
});

window.addEventListener("resize", () => {
  if (state.problem) {
    board.style.setProperty("--cell", getCellSize(state.problem.cols));
    window.requestAnimationFrame(updateColumnGuide);
  }
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    if (state.problem) {
      board.style.setProperty("--cell", getCellSize(state.problem.cols));
      updateColumnGuide();
    }
  }, 200);
});

renderHome();