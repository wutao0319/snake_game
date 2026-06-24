const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const rankingListEl = document.getElementById("ranking-list");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const soundBtn = document.getElementById("sound-btn");
const gameStageEl = document.querySelector(".game-stage");
const startOverlayEl = document.getElementById("start-overlay");
const startTitleEl = document.getElementById("start-title");
const startSubtitleEl = document.getElementById("start-subtitle");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const initialSpeed = 140;
const rankingStorageKey = "snakeGameRanking";
const soundStorageKey = "snakeGameSoundEnabled";
const maxRankingSize = 5;
const particlePalette = ["#ff7b60", "#ffcf40", "#fff1c9", "#5bd5ff"];
const musicBeatDuration = 0.24;
const musicLookahead = 0.35;

const directions = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  W: { x: 0, y: -1 },
  up: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  S: { x: 0, y: 1 },
  down: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  A: { x: -1, y: 0 },
  left: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  D: { x: 1, y: 0 },
  right: { x: 1, y: 0 }
};

const countdownSequence = [
  { title: "3", subtitle: "准备出发", isGo: false },
  { title: "2", subtitle: "进入状态", isGo: false },
  { title: "1", subtitle: "马上开始", isGo: false },
  { title: "GO!", subtitle: "像素蛇冲刺", isGo: true }
];

const musicBassPattern = [82.41, null, 82.41, null, 98.0, null, 110.0, null];
const musicLeadPattern = [659.25, null, 783.99, null, 880.0, 783.99, 659.25, null];
const musicAccentPattern = [null, 1046.5, null, 987.77, null, 880.0, null, 783.99];

let audioContext = null;
let snake;
let direction;
let nextDirection;
let food;
let score;
let rankings = loadRankings();
let soundEnabled = loadSoundEnabled();
let particles = [];
let gameTimer = null;
let countdownTimer = null;
let animationFrameId = null;
let lastFrameTime = 0;
let musicSchedulerId = null;
let musicNextNoteTime = 0;
let musicStepIndex = 0;
let gameStarted = false;
let isPaused = false;
let isCountingDown = false;
let gameEnded = false;
let speed = initialSpeed;
let swipeStartPoint = null;

ctx.imageSmoothingEnabled = false;

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  food = createFood();
  score = 0;
  speed = initialSpeed;
  gameStarted = false;
  isPaused = false;
  gameEnded = false;
  particles = [];
  cancelCountdown();
  clearTimer();
  stopBackgroundMusic();
  updateScore();
  setStatus("点击“开始游戏”开始");
  pauseBtn.textContent = "暂停";
}

function startGame() {
  if (isCountingDown || (gameStarted && !isPaused)) {
    return;
  }

  unlockAudio();

  if (isPaused) {
    isPaused = false;
    setStatus("继续冲分");
    pauseBtn.textContent = "暂停";
    playPauseSound(true);
    clearTimer();
    gameTimer = window.setInterval(step, speed);
    startBackgroundMusic();
    return;
  }

  beginCountdown();
}

function beginCountdown() {
  cancelCountdown();
  clearTimer();
  isCountingDown = true;
  gameEnded = false;
  setStatus("倒计时开始");
  startBackgroundMusic();

  let index = 0;

  const showStep = () => {
    const currentStep = countdownSequence[index];
    if (!currentStep) {
      finishCountdown();
      return;
    }

    showStartOverlay(currentStep.title, currentStep.subtitle, currentStep.isGo);
    playCountdownSound(currentStep.isGo);
    index += 1;
    countdownTimer = window.setTimeout(showStep, currentStep.isGo ? 360 : 520);
  };

  showStep();
}

function finishCountdown() {
  cancelCountdown();
  gameStarted = true;
  isPaused = false;
  gameEnded = false;
  pauseBtn.textContent = "暂停";
  setStatus("像素蛇出发中");
  clearTimer();
  gameTimer = window.setInterval(step, speed);
  startBackgroundMusic();
}

function togglePause() {
  if (!gameStarted || isCountingDown) {
    return;
  }

  if (isPaused) {
    startGame();
    return;
  }

  isPaused = true;
  clearTimer();
  pauseBtn.textContent = "继续";
  setStatus("游戏已暂停");
  stopBackgroundMusic();
  playPauseSound(false);
}

function restartGame() {
  unlockAudio();
  resetGame();
  beginCountdown();
}

function clearTimer() {
  if (gameTimer !== null) {
    window.clearInterval(gameTimer);
    gameTimer = null;
  }
}

function cancelCountdown() {
  if (countdownTimer !== null) {
    window.clearTimeout(countdownTimer);
    countdownTimer = null;
  }

  isCountingDown = false;
  hideStartOverlay();
}

function step() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  if (isOutOfBounds(head) || isSelfCollision(head)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    updateScore();
    spawnFoodParticles(food.x, food.y);
    food = createFood();
    increaseDifficulty();
    setStatus(`得分 +10，当前 ${score} 分`);
    playEatSound();
  } else {
    snake.pop();
  }
}

function increaseDifficulty() {
  const nextSpeed = Math.max(70, initialSpeed - Math.floor(score / 30) * 10);
  if (nextSpeed === speed) {
    return;
  }

  speed = nextSpeed;
  if (!isPaused) {
    clearTimer();
    gameTimer = window.setInterval(step, speed);
  }
}

function createFood() {
  let nextFood;

  do {
    nextFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake && snake.some((segment) => segment.x === nextFood.x && segment.y === nextFood.y));

  return nextFood;
}

function isOutOfBounds(position) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.x >= tileCount ||
    position.y >= tileCount
  );
}

function isSelfCollision(head) {
  return snake.some((segment) => segment.x === head.x && segment.y === head.y);
}

function gameOver() {
  clearTimer();
  cancelCountdown();
  stopBackgroundMusic();
  gameStarted = false;
  isPaused = false;
  gameEnded = true;
  pauseBtn.textContent = "暂停";
  saveScore(score);
  setStatus(`游戏结束，最终分数 ${score}`);
  playGameOverSound();
}

function updateScore() {
  scoreEl.textContent = String(score);
  updateBestScore();
}

function updateBestScore() {
  const bestScore = rankings.length > 0 ? rankings[0].score : 0;
  const currentScore = typeof score === "number" ? score : 0;
  bestScoreEl.textContent = String(Math.max(bestScore, currentScore));
}

function setStatus(message) {
  statusEl.textContent = message;
}

function render(timestamp) {
  if (lastFrameTime === 0) {
    lastFrameTime = timestamp;
  }

  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  updateParticles(deltaTime);
  drawScene();
  animationFrameId = window.requestAnimationFrame(render);
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawFood();
  drawParticles();
  drawSnake();

  if (gameEnded) {
    drawOverlay("GAME OVER", "按重新开始继续挑战");
  } else if (!gameStarted && !isCountingDown && score === 0) {
    drawOverlay("READY", "点击开始或按方向键");
  } else if (isPaused) {
    drawOverlay("PAUSE", "按空格或点中键继续");
  }
}

function drawBoard() {
  for (let x = 0; x < tileCount; x += 1) {
    for (let y = 0; y < tileCount; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#25193a" : "#2e2046";
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    }
  }

  ctx.strokeStyle = "#160f23";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;

    ctx.fillStyle = index === 0 ? "#7be058" : "#54c742";
    ctx.fillRect(x + 1, y + 1, gridSize - 2, gridSize - 2);

    ctx.fillStyle = index === 0 ? "#bfff95" : "#89f068";
    ctx.fillRect(x + 3, y + 3, gridSize - 10, gridSize - 10);

    if (index === 0) {
      drawSnakeEyes(x, y);
    }
  });
}

function drawSnakeEyes(x, y) {
  ctx.fillStyle = "#201730";

  if (direction.x === 1) {
    ctx.fillRect(x + 13, y + 5, 3, 3);
    ctx.fillRect(x + 13, y + 12, 3, 3);
  } else if (direction.x === -1) {
    ctx.fillRect(x + 4, y + 5, 3, 3);
    ctx.fillRect(x + 4, y + 12, 3, 3);
  } else if (direction.y === -1) {
    ctx.fillRect(x + 5, y + 4, 3, 3);
    ctx.fillRect(x + 12, y + 4, 3, 3);
  } else {
    ctx.fillRect(x + 5, y + 13, 3, 3);
    ctx.fillRect(x + 12, y + 13, 3, 3);
  }
}

function drawFood() {
  const x = food.x * gridSize;
  const y = food.y * gridSize;

  ctx.fillStyle = "#ff7b60";
  ctx.fillRect(x + 3, y + 4, 14, 12);
  ctx.fillStyle = "#ffb26b";
  ctx.fillRect(x + 6, y + 2, 4, 3);
  ctx.fillStyle = "#fff1c9";
  ctx.fillRect(x + 6, y + 7, 3, 3);
}

function spawnFoodParticles(tileX, tileY) {
  const centerX = tileX * gridSize + gridSize / 2;
  const centerY = tileY * gridSize + gridSize / 2;

  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18 + Math.random() * 0.35;
    const velocity = 55 + Math.random() * 70;

    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.65 + Math.random() * 0.25,
      maxLife: 0.85 + Math.random() * 0.2,
      size: 3 + Math.random() * 5,
      color: particlePalette[index % particlePalette.length]
    });
  }
}

function updateParticles(deltaTime) {
  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * deltaTime,
      y: particle.y + particle.vy * deltaTime,
      vx: particle.vx * 0.96,
      vy: particle.vy * 0.96 + 26 * deltaTime,
      life: particle.life - deltaTime
    }))
    .filter((particle) => particle.life > 0);
}

function drawParticles() {
  particles.forEach((particle) => {
    const alpha = Math.max(particle.life / particle.maxLife, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size
    );
  });

  ctx.globalAlpha = 1;
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(17, 11, 28, 0.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff8dd";
  ctx.font = "bold 28px Courier New";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);

  ctx.font = "15px Courier New";
  ctx.fillStyle = "#d6c7f6";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 22);
}

function handleDirectionChange(key) {
  const selectedDirection = directions[key];
  if (!selectedDirection) {
    return false;
  }

  const baseDirection = isCountingDown || gameStarted ? nextDirection : direction;
  const isReverse =
    selectedDirection.x === -baseDirection.x && selectedDirection.y === -baseDirection.y;

  if (isReverse) {
    return true;
  }

  nextDirection = selectedDirection;

  if (!gameStarted && !isCountingDown) {
    startGame();
  }

  return true;
}

function handleSwipeGesture(startPoint, endPoint) {
  if (!startPoint || !endPoint) {
    return false;
  }

  const deltaX = endPoint.x - startPoint.x;
  const deltaY = endPoint.y - startPoint.y;
  const threshold = 24;

  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
    return false;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return handleDirectionChange(deltaX > 0 ? "right" : "left");
  }

  return handleDirectionChange(deltaY > 0 ? "down" : "up");
}

function loadRankings() {
  try {
    const stored = window.localStorage.getItem(rankingStorageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item.score === "number" && typeof item.date === "string")
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRankingSize);
  } catch (error) {
    return [];
  }
}

function saveScore(finalScore) {
  if (finalScore <= 0) {
    renderRankings();
    updateBestScore();
    return;
  }

  rankings = [
    ...rankings,
    {
      score: finalScore,
      date: new Date().toLocaleString("zh-CN", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    }
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRankingSize);

  try {
    window.localStorage.setItem(rankingStorageKey, JSON.stringify(rankings));
  } catch (error) {
    return;
  }

  renderRankings();
  updateBestScore();
}

function renderRankings() {
  if (rankings.length === 0) {
    rankingListEl.innerHTML = '<li class="ranking-empty">还没有记录，先来一局吧</li>';
    return;
  }

  rankingListEl.innerHTML = rankings
    .map(
      (item, index) => `
        <li>
          <span class="rank">#${index + 1}</span>
          <span class="meta">${item.date}</span>
          <span class="score">${item.score}</span>
        </li>
      `
    )
    .join("");
}

function loadSoundEnabled() {
  try {
    const stored = window.localStorage.getItem(soundStorageKey);
    return stored !== "false";
  } catch (error) {
    return true;
  }
}

function updateSoundButton() {
  soundBtn.textContent = `音效：${soundEnabled ? "开" : "关"}`;
  soundBtn.classList.toggle("is-muted", !soundEnabled);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  updateSoundButton();

  try {
    window.localStorage.setItem(soundStorageKey, String(soundEnabled));
  } catch (error) {
    return;
  }

  if (!soundEnabled) {
    stopBackgroundMusic();
    return;
  }

  unlockAudio();
  playTone(660, 0.07, { endFrequency: 760, volume: 0.04 });
  if (isCountingDown || (gameStarted && !isPaused)) {
    startBackgroundMusic();
  }
}

function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone(frequency, duration, options = {}) {
  if (!soundEnabled) {
    return;
  }

  const context = unlockAudio();
  if (!context) {
    return;
  }

  const {
    type = "square",
    volume = 0.045,
    when = 0,
    atTime = null,
    endFrequency = frequency
  } = options;

  const startTime = atTime ?? context.currentTime + when;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.linearRampToValueAtTime(endFrequency, startTime + duration);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function startBackgroundMusic() {
  if (!soundEnabled || musicSchedulerId !== null) {
    return;
  }

  const context = unlockAudio();
  if (!context) {
    return;
  }

  musicNextNoteTime = context.currentTime + 0.05;
  musicStepIndex = 0;
  scheduleBackgroundMusic();
  musicSchedulerId = window.setInterval(scheduleBackgroundMusic, 90);
}

function stopBackgroundMusic() {
  if (musicSchedulerId !== null) {
    window.clearInterval(musicSchedulerId);
    musicSchedulerId = null;
  }
}

function scheduleBackgroundMusic() {
  if (!soundEnabled) {
    stopBackgroundMusic();
    return;
  }

  const context = unlockAudio();
  if (!context) {
    return;
  }

  while (musicNextNoteTime < context.currentTime + musicLookahead) {
    scheduleMusicBeat(musicStepIndex, musicNextNoteTime);
    musicNextNoteTime += musicBeatDuration;
    musicStepIndex = (musicStepIndex + 1) % musicBassPattern.length;
  }
}

function scheduleMusicBeat(stepIndex, noteTime) {
  const bassNote = musicBassPattern[stepIndex];
  const leadNote = musicLeadPattern[stepIndex];
  const accentNote = musicAccentPattern[stepIndex];

  if (bassNote) {
    playTone(bassNote, 0.18, {
      atTime: noteTime,
      type: "triangle",
      endFrequency: bassNote * 0.96,
      volume: 0.032
    });
  }

  playTone(180, 0.03, {
    atTime: noteTime + 0.02,
    type: "square",
    endFrequency: 140,
    volume: 0.014
  });

  if (leadNote) {
    playTone(leadNote, 0.12, {
      atTime: noteTime + 0.01,
      type: "square",
      endFrequency: leadNote * 1.02,
      volume: 0.02
    });
  }

  if (accentNote) {
    playTone(accentNote, 0.08, {
      atTime: noteTime + 0.12,
      type: "triangle",
      endFrequency: accentNote * 0.99,
      volume: 0.013
    });
  }
}

function playCountdownSound(isGo) {
  if (isGo) {
    playTone(760, 0.1, { endFrequency: 980, volume: 0.05 });
    playTone(980, 0.14, { when: 0.08, endFrequency: 1220, volume: 0.04 });
    return;
  }

  playTone(540, 0.08, { endFrequency: 620, volume: 0.04 });
}

function playEatSound() {
  playTone(720, 0.05, { endFrequency: 940, volume: 0.045 });
  playTone(980, 0.07, { when: 0.03, endFrequency: 1150, volume: 0.03 });
}

function playPauseSound(isResuming) {
  if (isResuming) {
    playTone(480, 0.06, { endFrequency: 620, volume: 0.035 });
  } else {
    playTone(430, 0.08, { endFrequency: 300, volume: 0.03 });
  }
}

function playGameOverSound() {
  playTone(320, 0.13, { type: "sawtooth", endFrequency: 200, volume: 0.04 });
  playTone(210, 0.18, { type: "sawtooth", when: 0.09, endFrequency: 110, volume: 0.035 });
}

function showStartOverlay(title, subtitle, isGo) {
  startTitleEl.textContent = title;
  startSubtitleEl.textContent = subtitle;
  startOverlayEl.classList.add("is-visible");
  startOverlayEl.classList.toggle("is-go", isGo);
  startOverlayEl.classList.remove("animate");
  void startOverlayEl.offsetWidth;
  startOverlayEl.classList.add("animate");
}

function hideStartOverlay() {
  startOverlayEl.classList.remove("is-visible", "is-go", "animate");
}

document.addEventListener("keydown", (event) => {
  unlockAudio();

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (handleDirectionChange(event.key)) {
    event.preventDefault();
  }
});

gameStageEl.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    return;
  }

  unlockAudio();
  swipeStartPoint = { x: event.clientX, y: event.clientY };
});

gameStageEl.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch") {
    return;
  }

  event.preventDefault();
  handleSwipeGesture(swipeStartPoint, { x: event.clientX, y: event.clientY });
  swipeStartPoint = null;
});

gameStageEl.addEventListener("pointercancel", () => {
  swipeStartPoint = null;
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", () => {
  unlockAudio();
  togglePause();
});
restartBtn.addEventListener("click", restartGame);
soundBtn.addEventListener("click", toggleSound);

renderRankings();
updateSoundButton();
updateBestScore();
resetGame();
animationFrameId = window.requestAnimationFrame(render);
