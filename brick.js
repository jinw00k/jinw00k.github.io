(() => {
  const cvs = document.getElementById("game");
  const ctx = cvs.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ov-title");
  const ovMsg = document.getElementById("ov-msg");
  const btnStart = document.getElementById("btnStart");

  // --- 게임 상태 ---
  const W = cvs.width;    // 논리 해상도 (CSS로 스케일)
  const H = cvs.height;

  let running = false;
  let paused = false;
  let score = 0;
  let lives = 3;
  let level = 1;

  // 발판
  const paddle = {
    w: 80, h: 12,
    x: W/2 - 40,
    y: H - 28,
    speed: 12
  };

  // 공
  const ball = {
    r: 7,
    x: W/2, y: H/2,
    vx: 3.0, vy: -3.6
  };

  // 벽돌 구성
  const cfg = {
    cols: 8,
    rows: 5,
    brickW: 48,
    brickH: 18,
    gap: 6,
    offsetTop: 80
  };

  let bricks = [];

  function initBricks() {
    bricks = [];
    const totalW = cfg.cols * cfg.brickW + (cfg.cols - 1) * cfg.gap;
    const startX = (W - totalW) / 2;
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        bricks.push({
          x: startX + c * (cfg.brickW + cfg.gap),
          y: cfg.offsetTop + r * (cfg.brickH + cfg.gap),
          w: cfg.brickW,
          h: cfg.brickH,
          hp: 1 + Math.floor(r / 2), // 윗줄은 약, 아랫줄은 조금 단단
        });
      }
    }
  }

  function resetBallAndPaddle() {
    paddle.w = Math.max(60, 90 - (level - 1) * 6);
    paddle.x = W / 2 - paddle.w / 2;
    paddle.y = H - 28;

    ball.x = W / 2;
    ball.y = H - 60;
    const speed = 4 + Math.min(level * 0.6, 3);
    const angle = (-Math.PI / 3) + Math.random() * (Math.PI / 6); // 위쪽 방향 약간 랜덤
    ball.vx = speed * Math.cos(angle);
    ball.vy = -Math.abs(speed * Math.sin(angle));
  }

  function resetGame() {
    score = 0; lives = 3; level = 1;
    cfg.rows = 5; cfg.cols = 8;
    initBricks();
    resetBallAndPaddle();
    updateHud();
  }

  // --- 그리기 ---
  function clear() {
    ctx.clearRect(0, 0, W, H);
  }

  function drawPaddle() {
    ctx.fillStyle = "#6ea8fe";
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6, true, false);
  }

  function drawBall() {
    const g = ctx.createRadialGradient(ball.x-2, ball.y-3, 2, ball.x, ball.y, ball.r+2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#9cc3ff");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBricks() {
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      const base = b.hp === 1 ? "#b9f27c" : b.hp === 2 ? "#ffd562" : "#ff9e6e";
      ctx.fillStyle = base;
      roundRect(ctx, b.x, b.y, b.w, b.h, 4, true, false);
      // 윤곽선
      ctx.strokeStyle = "#223";
      ctx.lineWidth = 1;
      roundRect(ctx, b.x+0.5, b.y+0.5, b.w-1, b.h-1, 4, false, true);
    }
  }

  function drawWalls() {
    ctx.strokeStyle = "#2a3a72";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, W-20, H-20);
  }

  // --- 로직 ---
  function updateHud() {
    scoreEl.textContent = `점수 ${score}`;
    livesEl.textContent = `목숨 ${lives}`;
    levelEl.textContent = `레벨 ${level}`;
  }

  function update() {
    if (!running || paused) return;

    // 공 이동
    ball.x += ball.vx;
    ball.y += ball.vy;

    // 벽 충돌
    if (ball.x - ball.r < 12) { ball.x = 12 + ball.r; ball.vx *= -1; }
    if (ball.x + ball.r > W-12) { ball.x = W-12 - ball.r; ball.vx *= -1; }
    if (ball.y - ball.r < 12) { ball.y = 12 + ball.r; ball.vy *= -1; }

    // 바닥(목숨 감소)
    if (ball.y - ball.r > H) {
      lives--;
      updateHud();
      if (lives <= 0) {
        gameOver();
        return;
      }
      resetBallAndPaddle();
      pauseOverlay("실패", "공을 놓쳤어요! 다시 시도해보세요.<br>시작 버튼을 누르면 이어서 진행됩니다.");
      return;
    }

    // 발판 충돌
    if (circleRectCollide(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
      // 반사 각도: 발판 중심 대비 충돌 위치로 조절
      const hitPos = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2); // -1 ~ 1
      const speed = Math.hypot(ball.vx, ball.vy);
      const angle = (-Math.PI/3) * hitPos; // 좌우로 최대 60도
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
      // 살짝 위로 밀기
      ball.y = paddle.y - ball.r - 0.1;
    }

    // 벽돌 충돌
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      if (circleRectCollide(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)) {
        // 어느 면에 가까운지 보고 반사
        const overlapX = (ball.x < b.x) ? ball.x + ball.r - b.x :
                         (ball.x > b.x + b.w) ? (b.x + b.w) - (ball.x - ball.r) :
                         Math.min(ball.x + ball.r - b.x, (b.x + b.w) - (ball.x - ball.r));
        const overlapY = (ball.y < b.y) ? ball.y + ball.r - b.y :
                         (ball.y > b.y + b.h) ? (b.y + b.h) - (ball.y - ball.r) :
                         Math.min(ball.y + ball.r - b.y, (b.y + b.h) - (ball.y - ball.r));

        if (overlapX < overlapY) { ball.vx *= -1; }
        else { ball.vy *= -1; }

        b.hp--;
        score += 10;
        updateHud();
      }
    }

    // 스테이지 클리어 체크
    if (bricks.every(b => b.hp <= 0)) {
      level++;
      // 난이도 증가
      cfg.rows = Math.min(10, 5 + Math.floor(level/2));
      cfg.cols = Math.min(12, 8 + Math.floor(level/3));
      initBricks();
      resetBallAndPaddle();
      pauseOverlay("클리어!", `레벨 ${level}로 진행합니다. 준비되면 시작 버튼을 누르세요.`);
    }
  }

  function render() {
    clear();
    drawWalls();
    drawBricks();
    drawPaddle();
    drawBall();
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  // --- 입력(마우스/터치) ---
  // 마우스로 발판 이동: 캔버스 기준 좌표로 변환
  function setPaddleByClientX(clientX) {
    const rect = cvs.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width); // CSS 스케일 보정
    paddle.x = Math.max(12, Math.min(W - 12 - paddle.w, x - paddle.w / 2));
  }
  cvs.addEventListener("mousemove", (e) => {
    setPaddleByClientX(e.clientX);
  });
  // 터치 대응
  cvs.addEventListener("touchmove", (e) => {
    if (e.touches.length) setPaddleByClientX(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });

  // 키보드: 일시정지/재시작
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      togglePause();
    } else if (e.key === "r" || e.key === "R") {
      restart();
    }
  });

  // --- 유틸 ---
  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      pauseOverlay("일시정지", "스페이스키 또는 시작 버튼을 누르면 계속합니다.");
    } else {
      hideOverlay();
    }
  }

  function restart() {
    running = false; paused = false;
    resetGame();
    start();
  }

  function start() {
    running = true; paused = false;
    hideOverlay();
  }

  function gameOver() {
    running = false;
    pauseOverlay("게임 오버", `최종 점수: ${score}<br>R 키로 재시작할 수 있어요.`);
  }

  function pauseOverlay(title, msg) {
    ovTitle.textContent = title;
    ovMsg.innerHTML = msg;
    overlay.classList.remove("hidden");
    paused = true;
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  btnStart.addEventListener("click", () => {
    if (!running) { start(); }
    else if (paused) { paused = false; hideOverlay(); }
  });

  // 충돌 판정 (원-사각형)
  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx*dx + dy*dy) <= r*r;
  }

  // 둥근 사각형 그리기
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // --- 초기화 ---
  resetGame();
  pauseOverlay("시작", "마우스를 좌우로 움직여 발판을 조종하세요.<br>스페이스키: 일시정지/계속, R: 재시작");
  loop();
})();
