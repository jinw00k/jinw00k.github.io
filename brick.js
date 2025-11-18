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

  // 🔽 추가: RL 관련 요소
  const btnRL = document.getElementById("btnRL");
  const rlStatus = document.getElementById("rlStatus");

  const W = cvs.width;
  const H = cvs.height;

  const SPEED_SCALE = 2;

  let running = false;
  let paused = false;
  let score = 0;
  let lives = 3;
  let level = 1;

  // 🔽 추가: RL 상태 플래그
  let rlTraining = false;     // 학습 중인지
  let agentPlaying = false;   // 학습된 정책으로 데모 플레이 중인지

  const paddle = { w: 80, h: 12, x: W/2 - 40, y: H - 28, speed: 12 };
  const ball = { r: 7, x: W/2, y: H/2, vx: 3.0, vy: -3.6 };

  const cfg = { cols: 8, rows: 5, brickW: 48, brickH: 18, gap: 6, offsetTop: 80 };
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
          hp: 1 + Math.floor(r / 2),
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

    // 속도 = (기본값 + 레벨에 따른 가산) × SPEED_SCALE
    const base = 4 + Math.min(level * 0.6, 3);
    const speed = base * SPEED_SCALE;
    const angle = (-Math.PI / 3) + Math.random() * (Math.PI / 6);
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

  // -------- 그리기 --------
  function clear() { ctx.clearRect(0, 0, W, H); }
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
      ctx.strokeStyle = "#223"; ctx.lineWidth = 1;
      roundRect(ctx, b.x+0.5, b.y+0.5, b.w-1, b.h-1, 4, false, true);
    }
  }
  function drawWalls() {
    ctx.strokeStyle = "#2a3a72";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, W-20, H-20);
  }

  // -------- HUD --------
  function update() {
    if (!running || paused) return;

    // 🔽 에이전트가 플레이 중이면, 매 프레임마다 행동을 선택해 발판 이동
    if (agentPlaying) {
      const s = rlGetStateKey();
      const a = rlSelectActionGreedy(s);
      rlApplyAction(a);
    }

    physicsStep();
  }

  // -------- 물리 업데이트 (서브스텝) --------
  function physicsStep() {
    // 현재 속도 크기에 비례해서 서브스텝 수 증가 → 터널링 방지
    const speed = Math.hypot(ball.vx, ball.vy);
    const substeps = Math.min(8, Math.max(1, Math.ceil(speed / 4))); // 속도/4 당 1스텝, 최대 8
    const inv = 1 / substeps;

    for (let s = 0; s < substeps; s++) {
      // 작은 이동량으로 반복
      ball.x += ball.vx * inv;
      ball.y += ball.vy * inv;

      // 벽 충돌
      if (ball.x - ball.r < 12) { ball.x = 12 + ball.r; ball.vx *= -1; }
      if (ball.x + ball.r > W-12) { ball.x = W-12 - ball.r; ball.vx *= -1; }
      if (ball.y - ball.r < 12) { ball.y = 12 + ball.r; ball.vy *= -1; }

      // 바닥 체크
      if (ball.y - ball.r > H) {
        lives--;
        updateHud();
        if (lives <= 0) { gameOver(); return; }
        resetBallAndPaddle();
        pauseOverlay("실패", "공을 놓쳤어요! 시작 버튼을 누르면 이어서 진행됩니다.");
        return;
      }

      // 발판 충돌
      if (circleRectCollide(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
        const hitPos = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2); // -1~1
        const spd = Math.hypot(ball.vx, ball.vy);
        const angle = (-Math.PI/3) * hitPos; // 최대 60도
        ball.vx = spd * Math.sin(angle);
        ball.vy = -Math.abs(spd * Math.cos(angle));
        ball.y = paddle.y - ball.r - 0.01;
      }

      // 벽돌 충돌 (서브스텝에서도 체크)
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        if (circleRectCollide(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)) {
          // 면 판정: 중심 차이로 간단/안정 처리
          const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
          const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
          const dx = ball.x - cx;
          const dy = ball.y - cy;

          // 더 지배적인 축을 반전
          if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx *= -1;
            // 살짝 밀어내기
            ball.x += Math.sign(dx) * 0.5;
          } else {
            ball.vy *= -1;
            ball.y += Math.sign(dy) * 0.5;
          }

          b.hp--;
          score += 10;
          updateHud();
        }
      }

      // 스테이지 클리어
      if (bricks.every(b => b.hp <= 0)) {
        level++;
        cfg.rows = Math.min(10, 5 + Math.floor(level/2));
        cfg.cols = Math.min(12, 8 + Math.floor(level/3));
        initBricks();
        resetBallAndPaddle();
        pauseOverlay("클리어!", `레벨 ${level}로 진행합니다. 준비되면 시작 버튼을 누르세요.`);
        return;
      }
    }
  }

  function update() {
    if (!running || paused) return;
    physicsStep();
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

  // ==========================
  //   간단 Q-learning 에이전트
  // ==========================

  const RL = {
    q: {},          // stateKey -> [Q(a0), Q(a1), Q(a2)]
    alpha: 0.1,
    gamma: 0.99,
    epsilon: 1.0,
    minEps: 0.05,
    epsDecay: 0.995,
    episodes: 0
  };

  const ACTIONS = [0, 1, 2]; // 0: 왼쪽, 1: 가만히, 2: 오른쪽

  function rlGetQ(stateKey) {
    if (!RL.q[stateKey]) RL.q[stateKey] = [0, 0, 0];
    return RL.q[stateKey];
  }

  // 상태를 아주 거칠게 이산화
  // - 공이 패들과 어느 정도 상대 위치인지 (왼/중/오)
  // - 공이 내려오는 중인지 / 올라가는 중인지
  // - 벽돌 줄 수 (난이도)
  function rlGetStateKey() {
    const rel = (ball.x - paddle.x) / Math.max(paddle.w, 1); // 대략 0~1 근처
    let relBin;
    if (rel < 0.3) relBin = 0;
    else if (rel < 0.7) relBin = 1;
    else relBin = 2;

    const vyDir = ball.vy > 0 ? 1 : 0;
    const rowBin = Math.min(2, Math.floor(cfg.rows / 3)); // 0,1,2

    return `${relBin}_${vyDir}_${rowBin}`;
  }

  // 행동 적용: 패들 위치를 좌/정지/우로 조금 움직임
  function rlApplyAction(a) {
    const step = paddle.speed * 0.6; // 사람보다 살짝 느리게
    if (a === 0) {
      paddle.x -= step;
    } else if (a === 2) {
      paddle.x += step;
    }
    paddle.x = Math.max(12, Math.min(W - 12 - paddle.w, paddle.x));
  }

  function rlSelectAction(stateKey) {
    // ε-greedy
    if (Math.random() < RL.epsilon) {
      return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    }
    return rlSelectActionGreedy(stateKey);
  }

  function rlSelectActionGreedy(stateKey) {
    const qs = rlGetQ(stateKey);
    let bestA = 0, bestQ = qs[0];
    for (let i = 1; i < qs.length; i++) {
      if (qs[i] > bestQ) {
        bestQ = qs[i];
        bestA = i;
      }
    }
    return bestA;
  }

  function rlCheckTerminal() {
    const alive = bricks.filter(b => b.hp > 0).length;
    if (alive === 0) return { done: true, reason: "clear" };
    if (lives < 3)   return { done: true, reason: "dead" }; // 에피소드 시작 시 3으로 리셋
    return { done: false, reason: null };
  }

  // 메인 학습 루프
  async function rlTrain(numEpisodes = 30000) {
    if (rlTraining) return;
    rlTraining = true;
    agentPlaying = false;
    btnRL.textContent = "강화학습 중지";

    running = false;  // 사람 플레이는 멈춤
    paused = false;

    rlStatus.textContent = "강화학습 시작…";

    for (let ep = 1; ep <= numEpisodes && rlTraining; ep++) {
      // 1 에피소드 = 1스테이지 클리어 or 공 잃을 때까지
      resetGame();           // 점수/목숨/레벨/벽돌/공 초기화
      running = false;       // loop()의 update()는 사용하지 않음
      paused = false;

      let steps = 0;
      let done = false;
      let totalReward = 0;

      while (!done && steps < 2000 && rlTraining) {
        const s = rlGetStateKey();
        const a = rlSelectAction(s);
        rlApplyAction(a);

        const bricksBefore = bricks.filter(b => b.hp > 0).length;
        physicsStep(); // 기존 물리 엔진 그대로 사용
        const bricksAfter = bricks.filter(b => b.hp > 0).length;
        const destroyed = bricksBefore - bricksAfter;

        // 보상 설계:
        // - 매 스텝 -0.01 (빠르게 끝낼수록 유리)
        // - 벽돌 1개 부술 때 +1
        let r = -0.01 + destroyed * 1.0;

        const term = rlCheckTerminal();
        if (term.done) {
          if (term.reason === "clear") r += 100;
          else if (term.reason === "dead") r -= 100;
          done = true;
        }

        const s2 = rlGetStateKey();

        const q = rlGetQ(s);
        const q2 = rlGetQ(s2);
        const bestNext = Math.max(...q2);
        const target = r + (done ? 0 : RL.gamma * bestNext);
        const td = target - q[a];
        q[a] += RL.alpha * td;

        totalReward += r;
        steps++;
      }

      RL.episodes++;
      RL.epsilon = Math.max(RL.minEps, RL.epsilon * RL.epsDecay);

      rlStatus.textContent =
        `에피소드 ${ep} | 보상 ${totalReward.toFixed(1)} | ε=${RL.epsilon.toFixed(2)}`;

      // 너무 브라우저를 붙들고 있지 않도록 가끔씩 프레임 양보
      if (ep % 50 === 0) {
        await new Promise(requestAnimationFrame);
      }

      // 🔥 5000 에피소드마다 한 번씩 데모 플레이
      if (ep % 5000 === 0) {
        await rlDemoEpisode(ep);
      }
    }

    rlTraining = false;
    btnRL.textContent = "강화학습 시작";
    rlStatus.textContent = "강화학습 종료";
  }

  // 현재 학습된 정책으로 1스테이지를 실제 화면에 플레이해 보여주기
  async function rlDemoEpisode(ep) {
    rlStatus.textContent = `에피소드 ${ep} 정책으로 데모 플레이 중…`;

    resetGame();    // 다시 1스테이지로 초기화
    running = true; // 메인 루프 사용
    paused = false;
    agentPlaying = true;

    let done = false;
    let steps = 0;

    while (!done && steps < 2000) {
      // 매 프레임까지 기다리면서 update()/render()를 통해 에이전트 플레이
      await new Promise(requestAnimationFrame);
      const term = rlCheckTerminal();
      if (term.done) done = true;
      steps++;
    }

    agentPlaying = false;
    running = false; // 데모가 끝나면 멈춤

    rlStatus.textContent = `에피소드 ${ep} 데모 완료 (스텝 ${steps})`;
  }


  // -------- 입력 --------
  function setPaddleByClientX(clientX) {
    const rect = cvs.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(12, Math.min(W - 12 - paddle.w, x - paddle.w / 2));
  }
  cvs.addEventListener("mousemove", (e) => setPaddleByClientX(e.clientX));
  cvs.addEventListener("touchmove", (e) => {
    if (e.touches.length) setPaddleByClientX(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); togglePause(); }
    else if (e.key === "r" || e.key === "R") { restart(); }
  });

  // -------- 유틸/오버레이 --------
  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) pauseOverlay("일시정지", "스페이스키 또는 시작 버튼을 누르면 계속합니다.");
    else hideOverlay();
  }

  function restart() {
    running = false; paused = false;
    resetGame();
    start();
  }

  function start() { running = true; paused = false; hideOverlay(); }

  function gameOver() {
    // 🔽 RL 학습 중이면 UI와 running 상태는 건드리지 않음
    if (rlTraining) return;
    running = false;
    pauseOverlay("게임 오버", `최종 점수: ${score}<br>R 키로 재시작할 수 있어요.`);
  }

  function pauseOverlay(title, msg) {
    // 🔽 RL 학습 중에는 오버레이 표시 안 함 (DOM 오염 방지)
    if (rlTraining) return;
    ovTitle.textContent = title;
    ovMsg.innerHTML = msg;
    overlay.classList.remove("hidden");
    paused = true;
  }

  function hideOverlay() { overlay.classList.add("hidden"); }

  btnStart.addEventListener("click", () => {
    if (!running) start();
    else if (paused) { paused = false; hideOverlay(); }
  });

  // 🔽 강화학습 버튼: 토글 형식 (시작/중지)
  btnRL.addEventListener("click", () => {
    if (!rlTraining) {
      rlTrain(30000); // 필요하면 에피소드 수 조정
    } else {
      rlTraining = false; // 루프가 자연스럽게 종료되도록 플래그만 내림
      rlStatus.textContent = "강화학습 중지 요청됨";
    }
  });


  // 충돌 (원-사각형)
  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx*dx + dy*dy) <= r*r;
  }

  // 둥근 사각형
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

  // 초기화
  resetGame();
  pauseOverlay("시작", "마우스를 좌우로 움직여 발판을 조종하세요.<br>스페이스키: 일시정지/계속, R: 재시작");
  loop();
})();
