(() => {
  const $ = (s) => document.querySelector(s);
  const maxInput = $("#max");
  const countInput = $("#count");
  const sortCheckbox = $("#sort");
  const drawBtn = $("#drawBtn");
  const ballsEl = $("#balls");
  const copyBtn = $("#copyBtn");
  const historyList = $("#historyList");
  const clearHistoryBtn = $("#clearHistory");

  function clampInputs() {
    const max = Math.max(6, Math.min(99, Number(maxInput.value || 45)));
    maxInput.value = max;
    const count = Math.max(1, Math.min(10, Number(countInput.value || 6)));
    countInput.value = Math.min(count, max);
  }

  function pickUnique(count, max) {
    const s = new Set();
    while (s.size < count) s.add(1 + Math.floor(Math.random()*max));
    return [...s];
  }

  function renderBalls(nums, max) {
    ballsEl.innerHTML = "";
    const arr = sortCheckbox.checked ? nums.slice().sort((a,b)=>a-b) : nums;
    for (const n of arr) {
      const el = document.createElement("span");
      el.className = "ball";
      el.textContent = n;
      ballsEl.appendChild(el);
    }
  }

  function draw() {
    clampInputs();
    const max = +maxInput.value, count = +countInput.value;
    if (count > max) return alert("개수가 최대값보다 클 수 없어요.");
    const nums = pickUnique(count, max);
    renderBalls(nums, max);
    addHistory(nums);
  }

  function addHistory(nums) {
    const li = document.createElement("li");
    li.textContent = nums.slice().sort((a,b)=>a-b).join(", ");
    historyList.prepend(li);
    while (historyList.children.length > 30) historyList.removeChild(historyList.lastChild);
  }

  function copyResult() {
    const t = [...ballsEl.querySelectorAll(".ball")].map(b=>b.textContent).join(", ");
    if (!t) return;
    navigator.clipboard.writeText(t).then(
      ()=>alert("복사됨: " + t),
      ()=>alert("복사 실패")
    );
  }

  drawBtn.addEventListener("click", draw);
  copyBtn.addEventListener("click", copyResult);
  clearHistoryBtn.addEventListener("click", ()=> historyList.innerHTML = "");
  maxInput.addEventListener("change", clampInputs);
  countInput.addEventListener("change", clampInputs);
  sortCheckbox.addEventListener("change", ()=>{
    const cur = [...ballsEl.querySelectorAll(".ball")].map(b=>+b.textContent);
    if (cur.length) renderBalls(cur, +maxInput.value);
  });

  draw();
})();
