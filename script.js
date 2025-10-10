(function () {
  const maxInput = document.getElementById("max");
  const countInput = document.getElementById("count");
  const sortCheckbox = document.getElementById("sort");
  const drawBtn = document.getElementById("drawBtn");
  const ballsEl = document.getElementById("balls");
  const copyBtn = document.getElementById("copyBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");

  // 유효성: count <= max
  function clampInputs() {
    const max = Math.max(1, Math.min(99, Number(maxInput.value || 45)));
    maxInput.value = max;
    const count = Math.max(1, Math.min(10, Number(countInput.value || 6)));
    countInput.value = Math.min(count, max);
  }

  function pickUnique(count, max) {
    const picked = new Set();
    while (picked.size < count) {
      picked.add(Math.floor(Math.random() * max) + 1);
    }
    return Array.from(picked);
  }

  function renderBalls(numbers, max) {
    ballsEl.innerHTML = "";
    const sorted = sortCheckbox.checked
      ? [...numbers].sort((a, b) => a - b)
      : numbers;

    sorted.forEach((n) => {
      const span = document.createElement("span");
      span.className = "ball " + rangeClass(n, max);
      span.textContent = n;
      span.setAttribute("aria-label", `숫자 ${n}`);
      ballsEl.appendChild(span);
    });
  }

  // 범위별 색상 클래스
  function rangeClass(n, max) {
    const bucket = Math.ceil((n / max) * 5); // 1~5
    return "r" + Math.max(1, Math.min(5, bucket));
  }

  function draw() {
    clampInputs();
    const max = Number(maxInput.value);
    const count = Number(countInput.value);
    if (count > max) {
      alert("뽑을 개수는 최대 숫자보다 클 수 없어요.");
      return;
    }
    const nums = pickUnique(count, max);
    renderBalls(nums, max);
    pushHistory(nums);
  }

  function pushHistory(nums) {
    const li = document.createElement("li");
    const text = nums.slice().sort((a,b)=>a-b).join(", ");
    li.textContent = text;
    historyList.prepend(li);
    // 30개까지만 보관
    while (historyList.children.length > 30) {
      historyList.removeChild(historyList.lastChild);
    }
  }

  function copyResult() {
    const values = [...ballsEl.querySelectorAll(".ball")].map((b) => b.textContent);
    if (values.length === 0) return;
    const text = values.join(", ");
    navigator.clipboard.writeText(text).then(
      () => toast("복사되었습니다: " + text),
      () => alert("복사에 실패했어요. 브라우저 권한을 확인해주세요.")
    );
  }

  // 간단 토스트
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      Object.assign(t.style, {
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        background: "#121832",
        color: "#eaf0ff",
        border: "1px solid #2a3a72",
        padding: "10px 14px",
        borderRadius: "10px",
        boxShadow: "0 10px 20px rgba(0,0,0,.35)",
        zIndex: 9999,
        fontSize: "14px",
        opacity: "0",
        transition: "opacity .2s ease"
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.opacity = "0"), 1600);
  }

  // 이벤트
  drawBtn.addEventListener("click", draw);
  copyBtn.addEventListener("click", copyResult);
  clearHistoryBtn.addEventListener("click", () => (historyList.innerHTML = ""));
  maxInput.addEventListener("change", clampInputs);
  countInput.addEventListener("change", clampInputs);
  sortCheckbox.addEventListener("change", () => {
    const current = [...ballsEl.querySelectorAll(".ball")].map((b) =>
      Number(b.textContent)
    );
    if (current.length) renderBalls(current, Number(maxInput.value));
  });

  // 첫 로드 시 한 번 뽑기
  draw();
})();
