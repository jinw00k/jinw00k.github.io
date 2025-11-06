(()=> {
  // === 공통 지갑 ===
  const WALLET_KEY="jinu_wallet_v1";
  function loadWallet(){ const r=localStorage.getItem(WALLET_KEY); if(!r){const w={cash:1_000_000}; localStorage.setItem(WALLET_KEY,JSON.stringify(w)); return w;} try{return JSON.parse(r);}catch{const w={cash:1_000_000}; localStorage.setItem(WALLET_KEY,JSON.stringify(w)); return w;}}
  function saveWallet(w){ localStorage.setItem(WALLET_KEY, JSON.stringify(w)); }

  const LOTTO_KEY = "jinu_lotto_v1";
  const REWARD = 1_000_000_000; // 10억원
  const qs = s=>document.querySelector(s);

  // ISO 주차 간단 판별(지역/일요일 기준 차이 무시, 주간 고유키만 필요)
  function weekId(d=new Date()){
    const y=d.getFullYear();
    const start=new Date(y,0,1);
    const days=Math.floor((d - start)/86400000);
    const wk = Math.floor((days + start.getDay())/7)+1;
    return `${y}-W${wk}`;
  }

  function loadLotto(){
    const raw=localStorage.getItem(LOTTO_KEY);
    if(!raw){ const obj={ myNumbers:[], myWeek:null, results:{} }; localStorage.setItem(LOTTO_KEY,JSON.stringify(obj)); return obj; }
    try{ return JSON.parse(raw); }catch{ const obj={ myNumbers:[], myWeek:null, results:{} }; localStorage.setItem(LOTTO_KEY,JSON.stringify(obj)); return obj; }
  }
  function saveLotto(o){ localStorage.setItem(LOTTO_KEY, JSON.stringify(o)); }

  // 기존 숫자뽑기 로직 (6개 고유 난수)
  function pickNumbers(max=45, count=6){
    const pool=Array.from({length:max},(_,i)=>i+1);
    const res=[];
    for(let i=0;i<count;i++){
      const idx=Math.floor(Math.random()*pool.length);
      res.push(pool[idx]); pool.splice(idx,1);
    }
    return res.sort((a,b)=>a-b);
  }

  // UI 바인딩 (기존 요소)
  const drawBtn = qs("#drawBtn");
  const maxEl = qs("#max");
  const countEl = qs("#count");
  const sortEl = qs("#sort");
  const ballsEl = qs("#balls");
  const copyBtn = qs("#copyBtn");
  const clearHistoryBtn = qs("#clearHistory");
  const historyList = qs("#historyList");
  const saveMyNumbersBtn = qs("#saveMyNumbers");
  const lottoStatus = qs("#lottoStatus");

  function showBalls(nums){
    ballsEl.innerHTML="";
    nums.forEach(n=>{
      const b=document.createElement("div");
      b.className="ball"; b.textContent=n;
      ballsEl.appendChild(b);
    });
  }

  // HISTORY (간단)
  function pushHistory(nums){
    const li=document.createElement("li");
    li.textContent = nums.join(", ");
    historyList.prepend(li);
  }

  // === 주간 추첨 체크 ===
  function checkWeeklyDraw(){
    const lot = loadLotto();
    const wk = weekId();
    if(!lot.results[wk]){
      // 이번 주 최초 방문 → 당첨번호 생성
      const win = pickNumbers(45,6);
      lot.results[wk] = win;
      saveLotto(lot);
    }
    // 내 번호가 이번 주에 저장돼 있고, 아직 보상 반영 안됐다면 비교
    const my = lot.myNumbers || [];
    const myWk = lot.myWeek;
    const win = lot.results[wk];

    if(myWk === wk && my.length===6){
      const match = my.join(",") === win.join(",");
      if(match && !lot.paidWeek){
        const wallet = loadWallet();
        wallet.cash += REWARD; // 10억원 지급
        saveWallet(wallet);
        lot.paidWeek = wk; // 중복 지급 방지
        saveLotto(lot);
        lottoStatus.textContent = `🎉 당첨! 이번 주 보너스 ${REWARD.toLocaleString()}원이 지급되었습니다.`;
      } else {
        lottoStatus.textContent = `이번 주 당첨번호: ${win.join(", ")}  (내 번호와 ${match?"일치":"불일치"})`;
      }
    } else {
      lottoStatus.textContent = `이번 주 당첨번호가 생성되었습니다. ‘내 번호 저장’ 후 같은 주차에 재방문하면 자동 비교합니다.`;
    }
  }

  // 버튼 동작
  drawBtn.addEventListener("click", ()=>{
    let max=parseInt(maxEl.value,10)||45;
    let cnt=parseInt(countEl.value,10)||6;
    cnt=Math.max(6, Math.min(cnt, 10)); // 최소 6개
    const nums = pickNumbers(max, cnt);
    if(sortEl.checked) nums.sort((a,b)=>a-b);
    showBalls(nums); pushHistory(nums);
  });

  copyBtn.addEventListener("click", ()=>{
    const nums = Array.from(ballsEl.querySelectorAll(".ball")).map(b=>b.textContent);
    navigator.clipboard.writeText(nums.join(", "));
  });
  clearHistoryBtn.addEventListener("click", ()=>{ historyList.innerHTML=""; });

  // 내 번호 저장
  saveMyNumbersBtn.addEventListener("click", ()=>{
    const nums = Array.from(ballsEl.querySelectorAll(".ball")).map(b=>parseInt(b.textContent,10));
    if(nums.length!==6){ alert("먼저 숫자 6개를 뽑고 ‘내 번호 저장’을 눌러주세요."); return; }
    const lot = loadLotto();
    lot.myNumbers = [...nums].sort((a,b)=>a-b);
    lot.myWeek = weekId();         // 현재 주차에 대한 내 번호로 저장
    delete lot.paidWeek;           // 새 주차 다시 보상 가능
    saveLotto(lot);
    lottoStatus.textContent = `내 번호 저장됨 (${lot.myNumbers.join(", ")}) — 주차 ${lot.myWeek}`;
  });

  // 시작 시 주간 추첨
  checkWeeklyDraw();
})();
