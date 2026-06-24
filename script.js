const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const initialSpeed = 140;

let snake;
let direction;
let nextDirection;
let food;
let score;
let gameTimer = null;
let gameStarted = false;
let isPaused = false;
let speed = initialSpeed;

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
  clearTimer();
  updateScore();
  setStatus("点击“开始游戏”开始");
  pauseBtn.textContent = "暂停";
  draw();
}

function startGame() {
  if (gameStarted && !isPaused) {
    return;
  }

  if (!gameStarted) {
    gameStarted = true;
    setStatus("游戏进行中");
  } else if (isPaused) {
    isPaused = false;
    setStatus("游戏继续");
  }

  pauseBtn.textContent = "暂停";
  clearTimer();
  gameTimer = window.setInterval(step, speed);
}

function togglePause() {
  if (!gameStarted) {
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
}

function restartGame() {
  resetGame();
  startGame();
}

function clearTimer() {
  if (gameTimer !== null) {
    window.clearInterval(gameTimer);
    gameTimer = null;
  }
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
    food = createFood();
    increaseDifficulty();
  } else {
    snake.pop();
  }

  draw();
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
  gameStarted = false;
  isPaused = false;
  pauseBtn.textContent = "暂停";
  setStatus(`游戏结束，最终分数 ${score}`);
  draw(true);
}

function updateScore() {
  scoreEl.textContent = String(score);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function draw(gameEnded = false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawFood();
  drawSnake();

  if (gameEnded) {
    drawOverlay("游戏结束", "按“重新开始”再来一局");
  } else if (!gameStarted && score === 0) {
    drawOverlay("准备开始", "点击“开始游戏”或按方向键");
  } else if (isPaused) {
    drawOverlay("已暂停", "按空格或点击继续");
  }
}

function drawBoard() {
  for (let x = 0; x < tileCount; x += 1) {
    for (let y = 0; y < tileCount; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0f172a" : "#111c31";
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    }
  }
}

function drawSnake() {
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? "#22c55e" : "#4ade80";
    ctx.fillRect(
      segment.x * gridSize + 1,
      segment.y * gridSize + 1,
      gridSize - 2,
      gridSize - 2
    );
  });
}

function drawFood() {
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize / 2,
    food.y * gridSize + gridSize / 2,
    gridSize / 2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);

  ctx.font = "16px Arial";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 22);
}

function handleDirectionChange(key) {
  const directions = {
    ArrowUp: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 }
  };

  const selectedDirection = directions[key];
  if (!selectedDirection) {
    return false;
  }

  const isReverse =
    selectedDirection.x === -direction.x && selectedDirection.y === -direction.y;

  if (isReverse) {
    return true;
  }

  nextDirection = selectedDirection;

  if (!gameStarted) {
    gameStarted = true;
    setStatus("游戏进行中");
    clearTimer();
    gameTimer = window.setInterval(step, speed);
  }

  draw();
  return true;
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    draw();
    return;
  }

  if (handleDirectionChange(event.key)) {
    event.preventDefault();
  }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", () => {
  togglePause();
  draw();
});
restartBtn.addEventListener("click", restartGame);

resetGame();
