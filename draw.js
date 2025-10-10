(() => {
  const maxInput = document.getElementById("max");
  const countInput = document.getElementById("count");
  const sortCheckbox = document.getElementById("sort");
  const drawBtn = document.getElementById("drawBtn");
  const ballsEl = document.getElementById("balls");
  const copyBtn = document.getElementById("copyBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");

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

  function rangeClass(n, max) {
    const bucket = Math.ceil((n / max) * 5);
    return "r" + Math.max(1, Math.min(5, bucket));
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
      ballsEl.appendChild(span);
    });
  }

  function draw() {
    clampInputs();
    const max = Number(maxInput.value);
    const count = Number(countInput.value);
    if (count > max) {
      alert("뽑을 개수가 최대 숫자보다 클 수 없습니다.");
      return;
    }
    const nums = pickUnique(count, max);
    renderBalls(nums, max);
    addHistory(nums);
  }

  function addHistory(nums) {
    const li = document.createElement("li");
    const text = nums.slice().sort((a,b)=>a-b).join(", ");
    li.textContent = text;
    historyList.prepend(li);
    while (historyList.children.length > 30) {
      historyList.removeChild(historyList.lastChild);
    }
  }

  function copyResult() {
    const vals = [...ballsEl.querySelectorAll(".ball")].map(b => b.textContent);
    if (vals.length === 0) return;
    const text = vals.join(", ");
    navigator.clipboard.writeText(text).then(
      () => alert("복사됨: " + text),
      () => alert("복사 실패")
    );
  }

  drawBtn.addEventListener("click", draw);
  copyBtn.addEventListener("click", copyResult);
  clearHistoryBtn.addEventListener("click", () => {
    historyList.innerHTML = "";
  });
  maxInput.addEventListener("change", clampInputs);
  countInput.addEventListener("change", clampInputs);
  sortCheckbox.addEventListener("change", () => {
    const cur = [...ballsEl.querySelectorAll(".ball")].map(b => Number(b.textContent));
    if (cur.length) renderBalls(cur, Number(maxInput.value));
  });

  // 초기 실행
  draw();
})();
