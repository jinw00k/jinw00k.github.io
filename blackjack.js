(()=> {
  // === 공통 지갑 ===
  const WALLET_KEY="jinu_wallet_v1";
  function loadWallet(){ const r=localStorage.getItem(WALLET_KEY); if(!r){const w={cash:1_000_000}; localStorage.setItem(WALLET_KEY,JSON.stringify(w)); return w;} try{return JSON.parse(r);}catch{const w={cash:1_000_000}; localStorage.setItem(WALLET_KEY,JSON.stringify(w)); return w;}}
  function saveWallet(w){ localStorage.setItem(WALLET_KEY, JSON.stringify(w)); }
  const fmtWon = n => "₩ " + Math.round(n).toLocaleString("ko-KR");

  const BET = 30_000;

  const $ = s => document.querySelector(s);
  const dealerEl = $("#bj-dealer");
  const playerEl = $("#bj-player");
  const dealerTotalEl = $("#bj-dealer-total");
  const playerTotalEl = $("#bj-player-total");
  const statusEl = $("#bj-status");
  const btnNew = $("#bj-new");
  const btnHit = $("#bj-hit");
  const btnStand = $("#bj-stand");
  const btnReshuffle = $("#bj-redeal");
  const walletEl = $("#bjWallet");

  let wallet = loadWallet(); walletEl.textContent = fmtWon(wallet.cash);

  let deck = [], dealer=[], player=[], roundOver=false, betPlaced=false;

  let prevDealerLen=0, prevPlayerLen=0;
  const sleep = ms => new Promise(r=>setTimeout(r, ms));

  function buildDeck(){const s=["♠","♥","♦","♣"], r=["A","2","3","4","5","6","7","8","9","10","J","Q","K"]; const d=[]; for(const ss of s){ for(const rr of r){ d.push({rank:rr,suit:ss});}} return d;}
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
  function ensureDeck(){ if(deck.length<10) deck = shuffle(buildDeck()); }

  function handValue(h){ let t=0,a=0; for(const c of h){ if(c.rank==="A"){t+=11;a++;} else if(["K","Q","J"].includes(c.rank)){t+=10;} else t+=Number(c.rank);} while(t>21&&a>0){t-=10;a--;} return t; }

  function cardEl(card, back=false, animate=false){
    const el=document.createElement("div");
    el.className="card"+(back?" back":"")+(["♥","♦"].includes(card?.suit)?" red":"");
    if(animate) el.classList.add("deal");
    if(!back){ const r=document.createElement("div"); r.className="rank"; r.textContent=card.rank;
      const s=document.createElement("div"); s.className="suit"; s.textContent=card.suit; el.append(r,s);
    } else { el.setAttribute("aria-label","뒷면 카드"); }
    return el;
  }

  function render(hideDealerHole=true){
    const dGrow = dealer.length>prevDealerLen;
    const pGrow = player.length>prevPlayerLen;

    dealerEl.innerHTML="";
    dealer.forEach((c,i)=>{
      const hole = hideDealerHole && i===0 && !roundOver;
      const isNew = dGrow && i===dealer.length-1;
      dealerEl.appendChild(cardEl(c, hole, isNew && !hole));
    });

    playerEl.innerHTML="";
    player.forEach((c,i)=>{
      const isNew = pGrow && i===player.length-1;
      playerEl.appendChild(cardEl(c,false,isNew));
    });

    dealerTotalEl.textContent = roundOver ? handValue(dealer) : (dealer.length? "?" : "0");
    playerTotalEl.textContent = handValue(player);

    prevDealerLen=dealer.length; prevPlayerLen=player.length;
  }

  function dealOne(to){ ensureDeck(); const c=deck.pop(); to.push(c); return c; }

  async function initialDeal(){
    dealOne(dealer); render(true); await sleep(120);
    dealOne(player); render(true); await sleep(120);
    dealOne(dealer); render(true); await sleep(120);
    dealOne(player); render(true);
  }

  async function startRound(){
    // 베팅 차감
    if(wallet.cash < BET){ statusEl.textContent="지갑 잔액이 부족합니다. (필요: ₩30,000)"; return; }
    wallet.cash -= BET; saveWallet(wallet); walletEl.textContent = fmtWon(wallet.cash);
    betPlaced = true;

    roundOver=false; dealer=[]; player=[]; prevDealerLen=0; prevPlayerLen=0;
    btnHit.disabled=false; btnStand.disabled=false;
    statusEl.textContent="행운을 빌어요! (베팅: ₩30,000)";
    await initialDeal();

    const p=handValue(player), d=handValue(dealer);
    // 양쪽 블랙잭 체크
    if(p===21 || d===21){
      await revealDealerHole();
      await dealerDrawIfNeeded();
      settle();
    }
  }

  async function revealDealerHole(){
    roundOver=true; render(false);
    const first=dealerEl.querySelector(".card");
    if(first){ first.classList.add("flip"); await sleep(380); }
    roundOver=false;
  }

  async function dealerDrawIfNeeded(){
    while(handValue(dealer) < 17){ await sleep(200); dealOne(dealer); render(false); }
    await sleep(60);
  }

  function settle(){
    roundOver=true; render(false);
    const p=handValue(player), d=handValue(dealer);
    let msg="", delta=0;

    const isPlayerBJ = (player.length===2 && p===21);
    const isDealerBJ = (dealer.length===2 && d===21);

    if(p>21){ msg="버스트! 딜러 승"; delta = 0; }
    else if(d>21){ msg="딜러 버스트! 플레이어 승 🎉"; delta = BET*2; }
    else if(isPlayerBJ && !isDealerBJ){ msg="블랙잭! 3:2 지급 🎉"; delta = Math.round(BET*2.5); }
    else if(isDealerBJ && !isPlayerBJ){ msg="딜러 블랙잭"; delta = 0; }
    else if(p>d){ msg="플레이어 승 🎉"; delta = BET*2; }
    else if(p<d){ msg="딜러 승"; delta = 0; }
    else { msg="무승부(푸시)"; delta = BET; }

    // 베팅 정산 (이미 BET 차감됨 → delta 만큼 환불/수익 반영)
    if(betPlaced){
      wallet.cash += delta;
      saveWallet(wallet); walletEl.textContent = fmtWon(wallet.cash);
      betPlaced=false;
    }

    statusEl.textContent = msg + `  (정산: ${fmtWon(delta - BET)})`;
    btnHit.disabled=true; btnStand.disabled=true;
  }

  btnNew.addEventListener("click", async ()=>{
    if(deck.length<10) deck = shuffle(buildDeck());
    await startRound();
  });
  btnHit.addEventListener("click", async ()=>{
    if(roundOver) return;
    dealOne(player); render(true);
    if(handValue(player) >= 21){
      await revealDealerHole(); await dealerDrawIfNeeded(); settle();
    }
  });
  btnStand.addEventListener("click", async ()=>{
    if(roundOver) return;
    await revealDealerHole(); await dealerDrawIfNeeded(); settle();
  });
  btnReshuffle.addEventListener("click", ()=>{ deck = shuffle(buildDeck()); statusEl.textContent="덱을 새로 섞었습니다."; });

  // init
  deck = shuffle(buildDeck());
  statusEl.textContent = "‘새 게임(₩30,000)’을 눌러 시작하세요.";
  render(true);
})();
