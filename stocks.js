(() => {
  // ===== 기본 설정 =====
  const INITIAL_CASH = 1_000_000; // 100만원
  const STOCKS = [
    { id:"JMS", name:"진욱물산"  },
    { id:"JGC", name:"진욱건설"  },
    { id:"JEZ", name:"진욱전자"  },
    { id:"JBN", name:"진욱은행"  },
    { id:"JIT", name:"진욱투자"  },
  ];
  const HISTORY_KEEP = 168; // 최근 168시간(=7일) 스파크라인 유지

  // ===== 로컬 스토리지 =====
  const KEY = "jinu_stocks_v2";
  const qs = (s) => document.querySelector(s);
  const fmtWon = (n) => "₩ " + Math.round(n).toLocaleString("ko-KR");
  const clamp = (x,min,max)=>Math.max(min, Math.min(max,x));
  const nowHour = () => Math.floor(Date.now()/3600000);       // UTC 기준 단순화
  const randPct = () => (Math.random()*2 - 1) / 100;          // -1% ~ +1%

  function defaultState(){
    const prices = {}, prev = {}, hist = {};
    STOCKS.forEach((s,i)=>{
      const base = [21000, 34000, 69000, 18000, 120000][i] ?? (20000 + i*5000);
      prices[s.id] = base; prev[s.id] = base;
      hist[s.id] = [base];
    });
    return {
      version:2,
      lastHour: nowHour(),
      cash: INITIAL_CASH,
      prices,
      prevPrices: prev,
      holds: { JMS:0, JGC:0, JEZ:0, JBN:0, JIT:0 },
      history: [], // {ts, side, id, qty, price}
      priceHist: hist
    };
  }
  function loadState(){
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    try{
      const st = JSON.parse(raw);
      st.priceHist ||= {}; STOCKS.forEach(s=>{ st.priceHist[s.id] ||= [st.prices?.[s.id] ?? 10000]; });
      st.prevPrices ||= {};
      return st;
    }catch{ return defaultState(); }
  }
  function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }

  // ===== 가격 틱 & 히스토리 =====
  function pushHistory(){
    STOCKS.forEach(s=>{
      const arr = state.priceHist[s.id] ||= [];
      arr.push(state.prices[s.id]);
      if(arr.length > HISTORY_KEEP) arr.splice(0, arr.length - HISTORY_KEEP);
    });
  }
  function tickOnce(){
    STOCKS.forEach(s => { state.prevPrices[s.id] = state.prices[s.id]; });
    STOCKS.forEach(s => {
      const p = state.prices[s.id];
      const np = Math.max(1, p * (1 + randPct()));
      state.prices[s.id] = Math.round(np);
    });
    pushHistory();
  }
  function catchUpToNow(){
    const curH = nowHour();
    const diff = curH - state.lastHour;
    if(diff > 0){
      for(let i=0;i<diff;i++) tickOnce();
      state.lastHour = curH; saveState();
    }
  }

  // ===== 계산 =====
  function portfolioValue(){
    let v = state.cash;
    STOCKS.forEach(s => v += state.holds[s.id] * state.prices[s.id]);
    return v;
  }
  function returnPct(){
    const gain = portfolioValue() - INITIAL_CASH;
    return (gain / INITIAL_CASH) * 100;
  }

  // ===== UI 렌더 =====
  function renderTop(){
    qs("#totalValue").textContent = fmtWon(portfolioValue());
    const rp = returnPct();
    const el = qs("#returnPct");
    el.textContent = (rp>=0?"+":"") + rp.toFixed(2) + " %";
    el.style.color = rp>=0 ? "var(--good)" : "var(--bad)";
    qs("#cash").textContent = fmtWon(state.cash);
  }

  function renderList(){
    const list = qs("#list"); list.innerHTML = "";
    STOCKS.forEach(s => {
      const cur = state.prices[s.id];
      const prev = state.prevPrices[s.id] ?? cur;
      const diff = cur - prev;
      const pct = prev ? (diff/prev)*100 : 0;
      const up = diff >= 0;

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="row">
          <div>
            <div class="name">${s.name}</div>
            <div class="code">${s.id}</div>
          </div>
          <div class="right">
            <div class="price">${fmtWon(cur)}</div>
            <div class="delta ${up?'up':'down'}">${up?'+':''}${diff.toLocaleString()} (${up?'+':''}${pct.toFixed(2)}%)</div>
          </div>
        </div>

        <div class="spark">
          <canvas class="sparkline" width="140" height="36"></canvas>
          <div class="minmax">
            <div>최저 ${fmtWon(minHist(s.id))}</div>
            <div>최고 ${fmtWon(maxHist(s.id))}</div>
          </div>
        </div>

        <div class="controls">
          <input type="number" min="1" step="1" placeholder="수량" class="qty" />
          <div class="own right">보유: ${state.holds[s.id]}주</div>
          <button class="btn buy">사기</button>
          <button class="btn sell">팔기</button>
        </div>
      `;

      // 이벤트
      const qtyEl = card.querySelector(".qty");
      const ownEl = card.querySelector(".own");

      card.querySelector(".buy").addEventListener("click", ()=>{
        const q = clamp(parseInt(qtyEl.value||"0",10), 1, 1e9);
        const cost = q * state.prices[s.id];
        if(cost > state.cash){ alert("현금이 부족합니다."); return; }
        state.cash -= cost;
        state.holds[s.id] += q;
        state.history.push({ts:Date.now(), side:"BUY", id:s.id, qty:q, price:state.prices[s.id]});
        saveState();
        renderTop();
        ownEl.textContent = `보유: ${state.holds[s.id]}주`;
        qtyEl.value = "";
      });

      card.querySelector(".sell").addEventListener("click", ()=>{
        const q = clamp(parseInt(qtyEl.value||"0",10), 1, 1e9);
        if(q > state.holds[s.id]){ alert("보유 수량이 부족합니다."); return; }
        const proceeds = q * state.prices[s.id];
        state.cash += proceeds;
        state.holds[s.id] -= q;
        state.history.push({ts:Date.now(), side:"SELL", id:s.id, qty:q, price:state.prices[s.id]});
        saveState();
        renderTop();
        ownEl.textContent = `보유: ${state.holds[s.id]}주`;
        qtyEl.value = "";
      });

      // 스파크라인
      const cv = card.querySelector(".sparkline");
      drawSparkline(cv, state.priceHist[s.id]);

      list.appendChild(card);
    });
  }

  function minHist(id){ return Math.min(...(state.priceHist[id]||[state.prices[id]])); }
  function maxHist(id){ return Math.max(...(state.priceHist[id]||[state.prices[id]])); }

  function drawSparkline(canvas, data){
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!data || data.length<2) return;

    const w = canvas.width, h = canvas.height;
    const min = Math.min(...data), max = Math.max(...data);
    const pad = 2;
    const N = data.length;
    const X = (i) => pad + (w-2*pad)*(i/(N-1));
    const Y = (v) => {
      if (max === min) return h/2;
      const t = (v - min) / (max - min);
      return h - pad - (h-2*pad)*t;
    };

    // 영역 채우기
    ctx.beginPath();
    ctx.moveTo(X(0), Y(data[0]));
    for(let i=1;i<N;i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.lineTo(X(N-1), h-pad); ctx.lineTo(X(0), h-pad); ctx.closePath();
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,"#2b5cff55"); grad.addColorStop(1,"#2b5cff00");
    ctx.fillStyle = grad; ctx.fill();

    // 라인
    ctx.beginPath();
    ctx.moveTo(X(0), Y(data[0]));
    for(let i=1;i<N;i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.lineWidth = 2; ctx.strokeStyle = "#5a8cff"; ctx.stroke();
  }

  // ===== 거래내역 바텀시트 =====
  function renderLedger(){
    const body = qs("#sheetBody"); body.innerHTML = "";
    const items = [...state.history].reverse();
    if(items.length===0){
      body.innerHTML = `<p style="color:var(--muted);text-align:center;padding:10px 0 18px">거래내역이 없습니다.</p>`;
      return;
    }
    for(const it of items){
      const d = new Date(it.ts);
      const ts = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      const side = it.side==="BUY" ? "buy" : "sell";
      const name = STOCKS.find(s=>s.id===it.id)?.name || it.id;
      const el = document.createElement("div");
      el.className = "ledger-item";
      el.innerHTML = `
        <div><span class="badge ${side}">${it.side==="BUY"?"매수":"매도"}</span></div>
        <div class="ledger-meta">${ts} · ${name} (${it.id}) · ${it.qty}주 @ ${fmtWon(it.price)}</div>
        <div class="ledger-amt ${side==='buy'?'delta down':'delta up'}">${side==='buy'?'-':'+'}${fmtWon(it.qty*it.price)}</div>
      `;
      body.appendChild(el);
    }
  }
  function openSheet(){ const s=qs("#sheet"); s.classList.add("show"); s.setAttribute("aria-hidden","false"); renderLedger(); }
  function closeSheet(){ const s=qs("#sheet"); s.classList.remove("show"); s.setAttribute("aria-hidden","true"); }

  // ===== 시계 & 정시 체크 =====
  function renderClock(){
    const d = new Date(); const hh = String(d.getHours()).padStart(2,"0"); const mm = String(d.getMinutes()).padStart(2,"0");
    qs("#clock").textContent = `${hh}:${mm}`;
  }
  function scheduleHourCheck(){
    setInterval(()=>{
      const curH = nowHour();
      if(curH > state.lastHour){
        const diff = curH - state.lastHour;
        for(let i=0;i<diff;i++) tickOnce();
        state.lastHour = curH; saveState();
        renderTop(); renderList();
      }
    }, 60*1000);
  }

  // ===== 리셋 =====
  function attachReset(){
    qs("#resetBtn").addEventListener("click", ()=>{
      if(confirm("모든 데이터(현금/보유/가격/히스토리)를 초기화할까요?")){
        state = defaultState(); saveState(); renderTop(); renderList();
      }
    });
  }

  // ===== 시작 =====
  let state = loadState();
  catchUpToNow();
  // 첫 로딩 시 히스토리 보정
  (function ensureFirstHistory(){ STOCKS.forEach(s=>{ const arr = state.priceHist[s.id]; if(!arr.length) arr.push(state.prices[s.id]); }); })();
  saveState();

  renderTop(); renderList();
  renderClock(); setInterval(renderClock, 1000);
  scheduleHourCheck(); attachReset();

  // 바텀시트 열고닫기
  qs("#ledgerBtn").addEventListener("click", openSheet);
  qs("#sheetClose").addEventListener("click", closeSheet);
  qs("#sheetCloseBtn").addEventListener("click", closeSheet);
})();
