import { useState, useMemo, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// MCHPai TRENCH — NBA-Style Trading Analytics Dashboard
// Every stat. Every angle. Every edge.
// ═══════════════════════════════════════════════════════════════

// ── Generate realistic sample trade data ──────────────────────
function generateSampleData() {
  const tiers = ["S","A","A","B","B","B","B"];
  const regimes = ["EUPHORIA","FEAR","ROTATION","ROTATION"];
  const exitReasons = ["take_profit","trail_stop","hard_stop","mirror_exit","mcts_exit","40x_panic","momentum_dump","atr_trailing","liquidity_dying","max_hold","stale_no_ticks"];
  const syms = ["PEPE","DOGE","BONK","WIF","BOME","POPCAT","MEW","MYRO","SLERF","BOOK","TREMP","MOTHER","GME","DADDY","BILLY","MICHI","GOAT","PNUT","FWOG","MOG","SPX","GIGA","BRETT","NEIRO","AI16Z","GRIFFAIN","PENGU","MOODENG","CHILLGUY","RETARDIO","LUIGI","VINE","KWEEN","BUTTHOLE","HAMMY","ARC","SWARM","ELIZA","PIPPIN","DOLOS","TANK","LUCE","SHOGGOTH","ZAILGO","BULLY","FARTCOIN"];
  const wallets = [];
  for(let i=0;i<80;i++) wallets.push({rank:i+1,tier:i<5?"S":i<15?"A":i<50?"B":"C",addr:"W"+String(i).padStart(3,"0"),name:"Alpha#"+(i+1)});
  const trades = [];
  const now = Date.now();
  const DAY = 86400000;
  for(let i=0;i<347;i++){
    const w = wallets[Math.floor(Math.random()*wallets.length)];
    const regime = regimes[Math.floor(Math.random()*regimes.length)];
    const ts = now - Math.floor(Math.random()*30*DAY);
    const hour = new Date(ts).getUTCHours();
    const isWin = Math.random() < (w.tier==="S"?0.72:w.tier==="A"?0.61:0.48);
    // Realistic memecoin PnL: wins 5-150%, losses 8-45% (rugs hit -80%+)
    const isRug = !isWin && Math.random() < 0.12;
    const pnlPct = isWin
      ? (Math.random()**0.7 * 145 + 5) // right-skewed: many small wins, few moonshots
      : isRug ? -(80 + Math.random()*18)
      : -(Math.random()*37 + 8);
    const maxRoi = isWin ? pnlPct*(1+Math.random()*0.3) : Math.random()*15;
    // Hold time: log-normal centered ~58s. Wins hold ~45-90s, losses cut fast 8-50s, rugs ~15s
    const holdSecs = isRug ? (8+Math.random()*20)
      : isWin ? (25 + Math.random()**0.6 * 110)  // wins: 25-135s, median ~62s
      : (8 + Math.random()**0.5 * 65);            // losses: 8-73s, median ~38s (hard stops fire fast)
    const sizeSol = (Math.random()*0.06+0.01);     // 0.01-0.07 SOL per trade
    const pnlSol = sizeSol*(pnlPct/100);
    // Exit reasons weighted by outcome — mirror exits are fastest
    const winExits = ["take_profit","trail_stop","mcts_exit","mirror_exit","40x_partial"];
    const lossExits = ["hard_stop","trail_stop","mirror_exit","momentum_dump","40x_panic","atr_trailing","liquidity_dying","stale_no_ticks"];
    const exitReason = isRug ? "hard_stop"
      : isWin ? winExits[Math.floor(Math.random()*winExits.length)]
      : lossExits[Math.floor(Math.random()*lossExits.length)];
    trades.push({
      id: i, ts, sym: syms[Math.floor(Math.random()*syms.length)],
      walletRank: w.rank, walletTier: w.tier, walletName: w.name,
      hmmRegime: regime, hour,
      sizeSol, pnlPct, pnlSol, maxRoi,
      drawdown: isWin ? -(Math.random()*12) : -(Math.random()*45+10),
      holdSecs: Math.round(holdSecs*10)/10, exitReason,
      isWin, isRug,
      s40x: Math.random(), les: Math.random(), smp: Math.random(),
      ci: Math.random(), ma: Math.random(),
      day: new Date(ts).getUTCDay(),
    });
  }
  return trades.sort((a,b)=>a.ts-b.ts);
}

// ── Math helpers ──────────────────────────────────────────────
const fmt = (n,d=2) => n===undefined||n===null?"--":Number(n).toFixed(d);
const fmtPct = (n,d=1) => (n>=0?"+":"")+fmt(n,d)+"%";
const fmtSol = (n) => (n>=0?"+":"")+fmt(n,4)+"◎";
const fmtTime = (s) => s===undefined||s===null?"--":s<60?fmt(s,1)+"s":s<3600?fmt(s/60,1)+"m":fmt(s/3600,1)+"h";
const fmtTimeFull = (s) => {if(!s)return"--";const m=Math.floor(s/60);const sec=Math.round(s%60);return m>0?m+"m "+sec+"s":sec+"s";}
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull = (ts) => new Date(ts).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

function calcStats(trades) {
  if(!trades.length) return {};
  const wins = trades.filter(t=>t.isWin);
  const losses = trades.filter(t=>!t.isWin);
  const pnls = trades.map(t=>t.pnlPct);
  const solPnls = trades.map(t=>t.pnlSol);
  const totalPnlSol = solPnls.reduce((a,b)=>a+b,0);
  const totalPnlPct = pnls.reduce((a,b)=>a+b,0);
  const avgWin = wins.length?wins.reduce((a,t)=>a+t.pnlPct,0)/wins.length:0;
  const avgLoss = losses.length?losses.reduce((a,t)=>a+t.pnlPct,0)/losses.length:0;
  const avgHold = trades.reduce((a,t)=>a+t.holdSecs,0)/trades.length;
  const avgHoldWin = wins.length?wins.reduce((a,t)=>a+t.holdSecs,0)/wins.length:0;
  const avgHoldLoss = losses.length?losses.reduce((a,t)=>a+t.holdSecs,0)/losses.length:0;
  // Sharpe (annualized, using per-trade returns)
  const mean = pnls.reduce((a,b)=>a+b,0)/pnls.length;
  const variance = pnls.reduce((a,v)=>a+(v-mean)**2,0)/pnls.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev>0?(mean/stdDev)*Math.sqrt(252):0;
  // Sortino
  const downside = pnls.filter(p=>p<0);
  const downsideVar = downside.length?downside.reduce((a,v)=>a+v**2,0)/downside.length:0;
  const sortino = Math.sqrt(downsideVar)>0?(mean/Math.sqrt(downsideVar))*Math.sqrt(252):0;
  // Profit factor
  const grossProfit = wins.reduce((a,t)=>a+t.pnlSol,0);
  const grossLoss = Math.abs(losses.reduce((a,t)=>a+t.pnlSol,0));
  const profitFactor = grossLoss>0?grossProfit/grossLoss:grossProfit>0?Infinity:0;
  // Expectancy
  const wr = wins.length/trades.length;
  const expectancy = (wr*avgWin)+((1-wr)*avgLoss);
  // Max drawdown (equity curve)
  let peak=0,maxDD=0,equity=0;
  const equityCurve=[];
  for(const t of trades){equity+=t.pnlSol;equityCurve.push(equity);if(equity>peak)peak=equity;const dd=peak-equity;if(dd>maxDD)maxDD=dd;}
  // Calmar
  const calmar = maxDD>0?totalPnlSol/maxDD:0;
  // Recovery factor
  const recovery = maxDD>0?totalPnlSol/maxDD:0;
  // Streaks
  let curStreak=0,bestWin=0,worstLoss=0,curWin=0,curLoss=0;
  for(const t of trades){
    if(t.isWin){curWin++;curLoss=0;if(curWin>bestWin)bestWin=curWin;}
    else{curLoss++;curWin=0;if(curLoss>worstLoss)worstLoss=curLoss;}
  }
  const lastTrade = trades[trades.length-1];
  curStreak=0;
  for(let i=trades.length-1;i>=0;i--){
    if(i===trades.length-1){curStreak=trades[i].isWin?1:-1;continue;}
    if(trades[i].isWin===(curStreak>0))curStreak+=curStreak>0?1:-1;else break;
  }
  // Records
  const bestTrade = trades.reduce((a,t)=>t.pnlPct>a.pnlPct?t:a,trades[0]);
  const worstTrade = trades.reduce((a,t)=>t.pnlPct<a.pnlPct?t:a,trades[0]);
  const fastestWin = wins.length?wins.reduce((a,t)=>t.holdSecs<a.holdSecs?t:a,wins[0]):null;
  const longestHold = trades.reduce((a,t)=>t.holdSecs>a.holdSecs?t:a,trades[0]);
  const biggestSolWin = wins.length?wins.reduce((a,t)=>t.pnlSol>a.pnlSol?t:a,wins[0]):null;
  const rugs = trades.filter(t=>t.isRug);
  // Payoff ratio
  const payoff = Math.abs(avgLoss)>0?avgWin/Math.abs(avgLoss):0;
  // Kelly
  const kelly = payoff>0?wr-(1-wr)/payoff:0;

  // Speed metrics — critical for sub-minute trading
  const holdTimes = trades.map(t=>t.holdSecs).sort((a,b)=>a-b);
  const medianHold = holdTimes[Math.floor(holdTimes.length/2)]||0;
  const p10Hold = holdTimes[Math.floor(holdTimes.length*0.1)]||0;
  const p90Hold = holdTimes[Math.floor(holdTimes.length*0.9)]||0;
  const sub30s = trades.filter(t=>t.holdSecs<30).length;
  const sub60s = trades.filter(t=>t.holdSecs<60).length;
  const over2m = trades.filter(t=>t.holdSecs>120).length;
  // Profit per second (efficiency metric — like points per minute in NBA)
  const profitPerSec = trades.reduce((a,t)=>a+t.pnlSol,0) / Math.max(1,trades.reduce((a,t)=>a+t.holdSecs,0));
  const profitPerSecWin = wins.length?wins.reduce((a,t)=>a+t.pnlSol,0)/Math.max(1,wins.reduce((a,t)=>a+t.holdSecs,0)):0;
  // Pace: trades per hour (during active sessions — estimate from trade timestamps)
  const sessionGaps = [];
  for(let i=1;i<trades.length;i++){const gap=trades[i].ts-trades[i-1].ts;if(gap<600000)sessionGaps.push(gap);}
  const avgGap = sessionGaps.length?sessionGaps.reduce((a,b)=>a+b,0)/sessionGaps.length:60000;
  const pace = 3600000/avgGap; // trades per hour during active trading
  // Win speed vs loss speed
  const winSpeedRatio = avgHoldLoss>0?avgHoldWin/avgHoldLoss:1;
  // PnL per second by tier
  const rugRate = rugs.length/trades.length;

  return {
    total:trades.length, wins:wins.length, losses:losses.length, wr,
    totalPnlSol, totalPnlPct, avgWin, avgLoss, avgHold, avgHoldWin, avgHoldLoss,
    sharpe, sortino, profitFactor, expectancy, maxDD, calmar, recovery,
    bestWin, worstLoss, curStreak, bestTrade, worstTrade, fastestWin, longestHold, biggestSolWin,
    rugs:rugs.length, payoff, kelly, grossProfit, grossLoss, stdDev, mean, equityCurve,
    avgSizeSol: trades.reduce((a,t)=>a+t.sizeSol,0)/trades.length,
    maxRoiAvg: trades.reduce((a,t)=>a+(t.maxRoi||0),0)/trades.length,
    avgDrawdown: trades.reduce((a,t)=>a+t.drawdown,0)/trades.length,
    // Speed metrics
    medianHold, p10Hold, p90Hold, sub30s, sub60s, over2m,
    profitPerSec, profitPerSecWin, pace, winSpeedRatio, rugRate,
  };
}

function splitBy(trades,key){
  const groups={};
  for(const t of trades){const k=t[key]||"unknown";if(!groups[k])groups[k]=[];groups[k].push(t);}
  return Object.entries(groups).map(([k,v])=>({label:k,trades:v,...calcStats(v)})).sort((a,b)=>b.totalPnlSol-a.totalPnlSol);
}

// ── Main Component ────────────────────────────────────────────
export default function TrenchStats() {
  const [tab, setTab] = useState("overview");
  const [trades] = useState(generateSampleData);
  const [logSort, setLogSort] = useState({key:"ts",asc:false});
  const [splitKey, setSplitKey] = useState("walletTier");

  const stats = useMemo(()=>calcStats(trades),[trades]);
  const splits = useMemo(()=>splitBy(trades,splitKey),[trades,splitKey]);
  const tierSplits = useMemo(()=>splitBy(trades,"walletTier"),[trades]);
  const regimeSplits = useMemo(()=>splitBy(trades,"hmmRegime"),[trades]);
  const exitSplits = useMemo(()=>splitBy(trades,"exitReason"),[trades]);
  const daySplits = useMemo(()=>{
    const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return splitBy(trades,"day").map(s=>({...s,label:names[s.label]||s.label}));
  },[trades]);

  // Hourly heatmap
  const hourly = useMemo(()=>{
    const h=Array.from({length:24},()=>({trades:0,pnl:0,wins:0}));
    for(const t of trades){h[t.hour].trades++;h[t.hour].pnl+=t.pnlSol;if(t.isWin)h[t.hour].wins++;}
    return h;
  },[trades]);

  // Wallet leaderboard
  const walletStats = useMemo(()=>{
    const map={};
    for(const t of trades){
      const k=t.walletRank;
      if(!map[k])map[k]={rank:k,tier:t.walletTier,name:t.walletName,trades:[],wins:0,pnlSol:0};
      map[k].trades.push(t);if(t.isWin)map[k].wins++;map[k].pnlSol+=t.pnlSol;
    }
    return Object.values(map).map(w=>({...w,total:w.trades.length,wr:w.wins/w.trades.length,avgPnl:w.pnlSol/w.trades.length,best:Math.max(...w.trades.map(t=>t.pnlPct))})).sort((a,b)=>b.pnlSol-a.pnlSol);
  },[trades]);

  // Equity curve points
  const equityPts = useMemo(()=>{
    let eq=0;return trades.map(t=>{eq+=t.pnlSol;return{ts:t.ts,eq,pnl:t.pnlSol,sym:t.sym};});
  },[trades]);

  // Last 20 trades for "recent form"
  const recent = trades.slice(-20);
  const recentStats = useMemo(()=>calcStats(recent),[recent]);

  // Sorted log
  const sortedLog = useMemo(()=>{
    const s=[...trades];
    s.sort((a,b)=>{
      let va=a[logSort.key],vb=b[logSort.key];
      if(typeof va==="string")return logSort.asc?va.localeCompare(vb):vb.localeCompare(va);
      return logSort.asc?va-vb:vb-va;
    });
    return s;
  },[trades,logSort]);

  const TABS=[
    {id:"overview",label:"Overview",icon:"📊"},
    {id:"advanced",label:"Advanced",icon:"🧮"},
    {id:"splits",label:"Splits",icon:"📐"},
    {id:"records",label:"Records",icon:"🏆"},
    {id:"wallets",label:"Wallets",icon:"👛"},
    {id:"heatmap",label:"Heat Map",icon:"🔥"},
    {id:"log",label:"Game Log",icon:"📋"},
    {id:"equity",label:"Equity",icon:"📈"},
  ];

  const c = {
    void:"#020408",srf:"#060b14",rise:"#0a1120",ridge:"#111c2f",
    go:"#00ffaa",stop:"#ff2d55",hold:"#ffcc00",data:"#00d4ff",
    spark:"#ff6b35",violet:"#8855ff",ink:"#ddeeff",ink2:"rgba(180,210,255,0.55)",ink3:"rgba(150,185,230,0.3)",
    wire:"rgba(0,180,255,0.07)",wire2:"rgba(0,180,255,0.14)",
  };

  const StatCard = ({label,value,sub,color,big})=>(
    <div style={{background:c.srf,border:`1px solid ${c.wire2}`,borderRadius:6,padding:big?"16px 12px":"10px 8px",textAlign:"center",minWidth:0}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:big?28:20,fontWeight:800,color:color||c.ink,lineHeight:1}}>{value}</div>
      <div style={{fontSize:8,color:c.ink3,letterSpacing:1.5,textTransform:"uppercase",marginTop:4}}>{label}</div>
      {sub&&<div style={{fontSize:9,color:c.ink2,marginTop:2}}>{sub}</div>}
    </div>
  );

  const Bar = ({pct,color,h=6})=>(
    <div style={{width:"100%",height:h,background:c.ridge,borderRadius:h/2,overflow:"hidden"}}>
      <div style={{width:Math.min(100,Math.max(0,pct))+"%",height:"100%",background:color||c.go,borderRadius:h/2,transition:"width 0.5s"}}/>
    </div>
  );

  const SplitTable = ({data})=>(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
        <thead><tr style={{borderBottom:`1px solid ${c.wire2}`}}>
          {["Split","Trades","W-L","Win%","Avg W","Avg L","PnL ◎","Sharpe","PF","Exp"].map(h=>(
            <th key={h} style={{padding:"6px 5px",textAlign:"left",color:c.ink3,fontSize:8,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{data.map((s,i)=>(
          <tr key={i} style={{borderBottom:`1px solid ${c.wire}`}}>
            <td style={{padding:"6px 5px",fontWeight:700,color:c.data}}>{s.label}</td>
            <td style={{padding:"6px 5px"}}>{s.total}</td>
            <td style={{padding:"6px 5px"}}>{s.wins}-{s.losses}</td>
            <td style={{padding:"6px 5px",color:s.wr>=0.55?c.go:s.wr<0.45?c.stop:c.hold}}>{(s.wr*100).toFixed(1)}%</td>
            <td style={{padding:"6px 5px",color:c.go}}>+{fmt(s.avgWin,1)}%</td>
            <td style={{padding:"6px 5px",color:c.stop}}>{fmt(s.avgLoss,1)}%</td>
            <td style={{padding:"6px 5px",color:s.totalPnlSol>=0?c.go:c.stop,fontWeight:700}}>{fmtSol(s.totalPnlSol)}</td>
            <td style={{padding:"6px 5px",color:s.sharpe>1?c.go:s.sharpe<0?c.stop:c.hold}}>{fmt(s.sharpe,2)}</td>
            <td style={{padding:"6px 5px",color:s.profitFactor>1.5?c.go:s.profitFactor<1?c.stop:c.hold}}>{fmt(s.profitFactor,2)}</td>
            <td style={{padding:"6px 5px",color:s.expectancy>0?c.go:c.stop}}>{fmtPct(s.expectancy)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );

  return (
    <div style={{fontFamily:"'JetBrains Mono','SF Mono','Fira Code',monospace",background:c.void,color:c.ink,minHeight:"100vh",padding:0,fontSize:11,lineHeight:1.5,position:"relative"}}>
      {/* Scanline overlay */}
      <div style={{position:"fixed",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)",pointerEvents:"none",zIndex:9999}}/>

      {/* ═══ HEADER / PLAYER CARD ═══ */}
      <div style={{background:`linear-gradient(135deg,${c.srf},${c.rise})`,borderBottom:`2px solid ${c.data}`,padding:"20px 16px 14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(22px,5vw,32px)",fontWeight:800,letterSpacing:-1}}>
              <span style={{color:c.data}}>M</span><span style={{color:c.go}}>C</span><span style={{color:c.hold}}>H</span>Pai
              <span style={{fontSize:12,color:c.ink3,fontWeight:400,marginLeft:8}}>TRENCH ANALYTICS</span>
            </div>
            <div style={{fontSize:9,color:c.ink3,letterSpacing:3,textTransform:"uppercase",marginTop:2}}>
              Season {new Date().getFullYear()} &middot; {stats.total} Games Played &middot; {fmtDate(trades[0]?.ts)} — {fmtDate(trades[trades.length-1]?.ts)}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{padding:"4px 10px",borderRadius:4,background:stats.curStreak>0?"rgba(0,255,170,0.12)":"rgba(255,45,85,0.12)",border:`1px solid ${stats.curStreak>0?c.go:c.stop}`,color:stats.curStreak>0?c.go:c.stop,fontSize:10,fontWeight:700}}>
              {stats.curStreak>0?"🔥":"❄️"} {Math.abs(stats.curStreak)} {stats.curStreak>0?"W":"L"} STREAK
            </div>
          </div>
        </div>
        {/* Headline stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:6,marginTop:14}}>
          <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} color={c.ink} big/>
          <StatCard label="Win %" value={(stats.wr*100).toFixed(1)+"%"} color={stats.wr>=0.55?c.go:stats.wr<0.45?c.stop:c.hold} big/>
          <StatCard label="Total PnL" value={fmtSol(stats.totalPnlSol)} color={stats.totalPnlSol>=0?c.go:c.stop} big/>
          <StatCard label="Sharpe" value={fmt(stats.sharpe)} color={stats.sharpe>1?c.go:stats.sharpe<0?c.stop:c.hold} big/>
          <StatCard label="Profit Factor" value={fmt(stats.profitFactor)} color={stats.profitFactor>1.5?c.go:c.stop} big/>
          <StatCard label="Max DD" value={fmt(stats.maxDD,4)+"◎"} color={c.stop} big/>
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div style={{display:"flex",overflowX:"auto",borderBottom:`1px solid ${c.wire}`,background:c.void,scrollbarWidth:"none"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:"0 0 auto",padding:"10px 12px",border:"none",background:"none",
            color:tab===t.id?c.data:c.ink3,fontSize:9,fontWeight:700,fontFamily:"inherit",
            cursor:"pointer",position:"relative",letterSpacing:0.5,whiteSpace:"nowrap",
            borderBottom:tab===t.id?`2px solid ${c.data}`:"2px solid transparent",transition:"all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ═══ PANELS ═══ */}
      <div style={{padding:"12px 12px 80px",maxWidth:960,margin:"0 auto"}}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&<div>
          {/* Recent Form */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Last 20 — Recent Form</div>
            <div style={{display:"flex",gap:3,marginBottom:8}}>
              {recent.map((t,i)=>(
                <div key={i} style={{width:14,height:14,borderRadius:3,background:t.isWin?c.go:c.stop,opacity:0.8+i*0.01,display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,fontWeight:700,color:c.void}}>
                  {t.isWin?"W":"L"}
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              <StatCard label="Last 20 W%" value={(recentStats.wr*100).toFixed(0)+"%"} color={recentStats.wr>=0.55?c.go:c.stop}/>
              <StatCard label="Last 20 PnL" value={fmtSol(recentStats.totalPnlSol)} color={recentStats.totalPnlSol>=0?c.go:c.stop}/>
              <StatCard label="Avg Win" value={fmtPct(recentStats.avgWin)} color={c.go}/>
              <StatCard label="Avg Loss" value={fmtPct(recentStats.avgLoss)} color={c.stop}/>
            </div>
          </div>

          {/* Core Stats Grid */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Career Stats</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6,marginBottom:16}}>
            <StatCard label="Games" value={stats.total}/>
            <StatCard label="Wins" value={stats.wins} color={c.go}/>
            <StatCard label="Losses" value={stats.losses} color={c.stop}/>
            <StatCard label="Rugs" value={stats.rugs} color={c.stop} sub="☠️"/>
            <StatCard label="Avg Win %" value={fmtPct(stats.avgWin)} color={c.go}/>
            <StatCard label="Avg Loss %" value={fmtPct(stats.avgLoss)} color={c.stop}/>
            <StatCard label="Avg Hold" value={fmtTime(stats.avgHold)} color={c.data}/>
            <StatCard label="Avg Size" value={fmt(stats.avgSizeSol,3)+"◎"} color={c.ink2}/>
            <StatCard label="Gross Profit" value={fmtSol(stats.grossProfit)} color={c.go}/>
            <StatCard label="Gross Loss" value={fmtSol(-stats.grossLoss)} color={c.stop}/>
            <StatCard label="Avg Max ROI" value={fmtPct(stats.maxRoiAvg)} color={c.hold}/>
            <StatCard label="Avg DD" value={fmt(stats.avgDrawdown,1)+"%"} color={c.stop}/>
          </div>

          {/* Speed & Tempo — unique to sub-minute trading */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginTop:16,marginBottom:8}}>⚡ Speed & Tempo</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6,marginBottom:16}}>
            <StatCard label="Avg Hold" value={fmtTime(stats.avgHold)} color={c.data} sub="all trades"/>
            <StatCard label="Median Hold" value={fmtTime(stats.medianHold)} color={c.data} sub="50th pctl"/>
            <StatCard label="Win Hold" value={fmtTime(stats.avgHoldWin)} color={c.go} sub="avg winner"/>
            <StatCard label="Loss Hold" value={fmtTime(stats.avgHoldLoss)} color={c.stop} sub="avg loser"/>
            <StatCard label="Fastest 10%" value={fmtTime(stats.p10Hold)} color={c.spark} sub="p10 hold"/>
            <StatCard label="Slowest 10%" value={fmtTime(stats.p90Hold)} color={c.ink2} sub="p90 hold"/>
            <StatCard label="Sub-30s" value={stats.sub30s} color={c.spark} sub={(stats.sub30s/stats.total*100).toFixed(0)+"% of trades"}/>
            <StatCard label="Sub-60s" value={stats.sub60s} color={c.hold} sub={(stats.sub60s/stats.total*100).toFixed(0)+"% of trades"}/>
            <StatCard label="Over 2m" value={stats.over2m} color={c.ink2} sub={(stats.over2m/stats.total*100).toFixed(0)+"% of trades"}/>
            <StatCard label="◎/Second" value={fmt(stats.profitPerSec*1000,3)} color={stats.profitPerSec>=0?c.go:c.stop} sub="milli-SOL/sec"/>
            <StatCard label="Pace" value={fmt(stats.pace,1)} color={c.data} sub="trades/hour"/>
            <StatCard label="Rug Rate" value={(stats.rugRate*100).toFixed(1)+"%"} color={stats.rugRate<0.1?c.go:c.stop} sub={stats.rugs+" total rugs"}/>
          </div>

          {/* Tier Performance */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Performance by Wallet Tier</div>
          <SplitTable data={tierSplits}/>

          {/* Regime Performance */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginTop:16,marginBottom:8}}>Performance by Market Regime</div>
          <SplitTable data={regimeSplits}/>
        </div>}

        {/* ── ADVANCED METRICS ── */}
        {tab==="advanced"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Advanced Analytics</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:20}}>
            <StatCard label="Sharpe Ratio" value={fmt(stats.sharpe)} color={stats.sharpe>1?c.go:stats.sharpe>0?c.hold:c.stop} sub="Risk-adjusted return" big/>
            <StatCard label="Sortino Ratio" value={fmt(stats.sortino)} color={stats.sortino>1.5?c.go:stats.sortino>0?c.hold:c.stop} sub="Downside-adjusted" big/>
            <StatCard label="Calmar Ratio" value={fmt(stats.calmar)} color={stats.calmar>1?c.go:c.hold} sub="Return / Max DD" big/>
            <StatCard label="Profit Factor" value={fmt(stats.profitFactor)} color={stats.profitFactor>1.5?c.go:stats.profitFactor>1?c.hold:c.stop} sub="Gross W / Gross L" big/>
            <StatCard label="Expectancy" value={fmtPct(stats.expectancy)} color={stats.expectancy>0?c.go:c.stop} sub="Expected per trade" big/>
            <StatCard label="Payoff Ratio" value={fmt(stats.payoff)+":1"} color={stats.payoff>1.5?c.go:c.hold} sub="Avg W / Avg L" big/>
            <StatCard label="Kelly %" value={(stats.kelly*100).toFixed(1)+"%"} color={stats.kelly>0?c.go:c.stop} sub="Optimal size %" big/>
            <StatCard label="Recovery Factor" value={fmt(stats.recovery)} color={stats.recovery>2?c.go:c.hold} sub="PnL / Max DD" big/>
            <StatCard label="Return StdDev" value={fmt(stats.stdDev,1)+"%"} color={c.data} sub="Per-trade volatility" big/>
            <StatCard label="Max Drawdown" value={fmt(stats.maxDD,4)+"◎"} color={c.stop} sub="Peak-to-trough" big/>
            <StatCard label="Avg Hold (Win)" value={fmtTime(stats.avgHoldWin)} color={c.go} sub="Winners" big/>
            <StatCard label="Avg Hold (Loss)" value={fmtTime(stats.avgHoldLoss)} color={c.stop} sub="Losers" big/>
            <StatCard label="Median Hold" value={fmtTime(stats.medianHold)} color={c.data} sub="50th percentile" big/>
            <StatCard label="◎/Second" value={fmt(stats.profitPerSec*1000,3)+"m◎"} color={stats.profitPerSec>=0?c.go:c.stop} sub="Profit efficiency" big/>
            <StatCard label="Pace" value={fmt(stats.pace,1)+"/hr"} color={c.data} sub="Active session" big/>
            <StatCard label="Rug Rate" value={(stats.rugRate*100).toFixed(1)+"%"} color={stats.rugRate<0.1?c.go:c.stop} sub={stats.rugs+" total"} big/>
          </div>

          {/* Hold Time Distribution */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Hold Time Distribution</div>
          <div style={{background:c.srf,border:`1px solid ${c.wire2}`,borderRadius:6,padding:12,marginBottom:16}}>
            {[
              {label:"< 15s (Lightning)",pct:stats.total?trades.filter(t=>t.holdSecs<15).length/stats.total*100:0,color:c.spark},
              {label:"15-30s (Quick)",pct:stats.total?trades.filter(t=>t.holdSecs>=15&&t.holdSecs<30).length/stats.total*100:0,color:c.hold},
              {label:"30-60s (Standard)",pct:stats.total?trades.filter(t=>t.holdSecs>=30&&t.holdSecs<60).length/stats.total*100:0,color:c.data},
              {label:"60-120s (Extended)",pct:stats.total?trades.filter(t=>t.holdSecs>=60&&t.holdSecs<120).length/stats.total*100:0,color:c.go},
              {label:"> 120s (Marathon)",pct:stats.total?stats.over2m/stats.total*100:0,color:c.violet},
            ].map((b,i)=>(
              <div key={i} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                  <span>{b.label}</span><span style={{color:b.color,fontWeight:700}}>{fmt(b.pct,1)}%</span>
                </div>
                <Bar pct={b.pct} color={b.color} h={8}/>
              </div>
            ))}
          </div>

          {/* Edge Analysis */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Edge Analysis</div>
          <div style={{background:c.srf,border:`1px solid ${c.wire2}`,borderRadius:6,padding:12}}>
            {[
              {label:"Win Rate",val:stats.wr*100,thresh:50,unit:"%",desc:"Above 50% = positive edge"},
              {label:"Profit Factor",val:stats.profitFactor,thresh:1,unit:"x",desc:"Above 1.0 = profitable system"},
              {label:"Expectancy",val:stats.expectancy,thresh:0,unit:"%",desc:"Above 0% = positive expected value"},
              {label:"Payoff Ratio",val:stats.payoff,thresh:1,unit:":1",desc:"Above 1:1 = wins larger than losses"},
              {label:"Sharpe Ratio",val:stats.sharpe,thresh:1,unit:"",desc:"Above 1.0 = good risk-adjusted"},
            ].map((m,i)=>(
              <div key={i} style={{padding:"8px 0",borderBottom:i<4?`1px solid ${c.wire}`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:700}}>{m.label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:m.val>=m.thresh?c.go:c.stop}}>{fmt(m.val,2)}{m.unit}</span>
                </div>
                <Bar pct={Math.min(100,Math.max(0,(m.val/m.thresh)*50))} color={m.val>=m.thresh?c.go:c.stop}/>
                <div style={{fontSize:8,color:c.ink3,marginTop:2}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* ── SPLITS ── */}
        {tab==="splits"&&<div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {[["walletTier","By Tier"],["hmmRegime","By Regime"],["exitReason","By Exit"],["day","By Day"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSplitKey(k)} style={{
                padding:"5px 12px",borderRadius:20,border:`1px solid ${splitKey===k?c.data:c.wire2}`,
                background:splitKey===k?c.data:"none",color:splitKey===k?c.void:c.ink2,
                fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}>{l}</button>
            ))}
          </div>
          <SplitTable data={splitKey==="day"?daySplits:splits}/>

          {/* Exit reason breakdown */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginTop:20,marginBottom:8}}>Exit Reason Breakdown</div>
          <SplitTable data={exitSplits}/>
        </div>}

        {/* ── RECORDS ── */}
        {tab==="records"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>🏆 Career Records</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {label:"Best Trade %",val:fmtPct(stats.bestTrade?.pnlPct),sub:stats.bestTrade?.sym+" — "+fmtDate(stats.bestTrade?.ts),color:c.go,icon:"🥇"},
              {label:"Worst Trade %",val:fmtPct(stats.worstTrade?.pnlPct),sub:stats.worstTrade?.sym+" — "+fmtDate(stats.worstTrade?.ts),color:c.stop,icon:"💀"},
              {label:"Best SOL Win",val:fmtSol(stats.biggestSolWin?.pnlSol),sub:stats.biggestSolWin?.sym,color:c.go,icon:"💰"},
              {label:"Fastest Win",val:fmtTime(stats.fastestWin?.holdSecs),sub:stats.fastestWin?.sym+" +"+fmt(stats.fastestWin?.pnlPct,0)+"%",color:c.data,icon:"⚡"},
              {label:"Longest Hold",val:fmtTime(stats.longestHold?.holdSecs),sub:stats.longestHold?.sym,color:c.hold,icon:"⏱️"},
              {label:"Best Win Streak",val:stats.bestWin+"W",sub:"Consecutive wins",color:c.go,icon:"🔥"},
              {label:"Worst Loss Streak",val:stats.worstLoss+"L",sub:"Consecutive losses",color:c.stop,icon:"❄️"},
              {label:"Total Rugs",val:stats.rugs,sub:"Tokens that lost 80%+",color:c.stop,icon:"☠️"},
              {label:"Current Streak",val:Math.abs(stats.curStreak)+(stats.curStreak>0?"W":"L"),sub:stats.curStreak>0?"On fire":"Cold spell",color:stats.curStreak>0?c.go:c.stop,icon:stats.curStreak>0?"🔥":"❄️"},
              {label:"Games Played",val:stats.total,sub:"Career total",color:c.data,icon:"🎮"},
              {label:"Median Hold",val:fmtTime(stats.medianHold),sub:"50th percentile",color:c.data,icon:"⏱️"},
              {label:"◎ Per Second",val:fmt(stats.profitPerSec*1000,3)+"m◎/s",sub:"Profit efficiency",color:stats.profitPerSec>=0?c.go:c.stop,icon:"⚡"},
              {label:"Trades/Hour",val:fmt(stats.pace,1),sub:"Active session pace",color:c.data,icon:"🏃"},
              {label:"Win Speed Ratio",val:fmt(stats.winSpeedRatio,2)+"x",sub:stats.winSpeedRatio>1?"Wins held longer":"Losses held longer",color:stats.winSpeedRatio>1?c.go:c.stop,icon:"⚖️"},
            ].map((r,i)=>(
              <div key={i} style={{background:c.srf,border:`1px solid ${c.wire2}`,borderRadius:6,padding:12}}>
                <div style={{fontSize:18,marginBottom:4}}>{r.icon}</div>
                <div style={{fontSize:8,color:c.ink3,letterSpacing:1,textTransform:"uppercase"}}>{r.label}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:r.color,lineHeight:1,margin:"4px 0"}}>{r.val}</div>
                <div style={{fontSize:9,color:c.ink2}}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* ── WALLETS (Player Rankings) ── */}
        {tab==="wallets"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Wallet Leaderboard — Player Rankings</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
              <thead><tr style={{borderBottom:`1px solid ${c.wire2}`}}>
                {["#","Tier","Wallet","GP","W-L","Win%","PnL ◎","Avg PnL","Best","WR Bar"].map(h=>(
                  <th key={h} style={{padding:"6px 4px",textAlign:"left",color:c.ink3,fontSize:7,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{walletStats.slice(0,30).map((w,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${c.wire}`}}>
                  <td style={{padding:"5px 4px",color:c.ink3}}>{i+1}</td>
                  <td style={{padding:"5px 4px"}}><span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:w.tier==="S"?"rgba(0,255,170,0.1)":w.tier==="A"?"rgba(255,204,0,0.1)":"rgba(0,212,255,0.06)",color:w.tier==="S"?c.go:w.tier==="A"?c.hold:c.ink2}}>{w.tier}</span></td>
                  <td style={{padding:"5px 4px",fontWeight:700,color:c.data,fontSize:9}}>{w.name}</td>
                  <td style={{padding:"5px 4px"}}>{w.total}</td>
                  <td style={{padding:"5px 4px"}}>{w.wins}-{w.total-w.wins}</td>
                  <td style={{padding:"5px 4px",color:w.wr>=0.6?c.go:w.wr<0.45?c.stop:c.hold,fontWeight:700}}>{(w.wr*100).toFixed(0)}%</td>
                  <td style={{padding:"5px 4px",color:w.pnlSol>=0?c.go:c.stop,fontWeight:700}}>{fmtSol(w.pnlSol)}</td>
                  <td style={{padding:"5px 4px",color:w.avgPnl>=0?c.go:c.stop}}>{fmtSol(w.avgPnl)}</td>
                  <td style={{padding:"5px 4px",color:c.go}}>+{fmt(w.best,0)}%</td>
                  <td style={{padding:"5px 4px",width:60}}><Bar pct={w.wr*100} color={w.wr>=0.55?c.go:w.wr<0.45?c.stop:c.hold}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>}

        {/* ── HEAT MAP ── */}
        {tab==="heatmap"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>🔥 Profitability Heat Map — Hour of Day (UTC)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3,marginBottom:16}}>
            {hourly.map((h,i)=>{
              const maxPnl = Math.max(...hourly.map(x=>Math.abs(x.pnl)),0.001);
              const intensity = Math.abs(h.pnl)/maxPnl;
              const bg = h.pnl>=0?`rgba(0,255,170,${0.05+intensity*0.4})`:`rgba(255,45,85,${0.05+intensity*0.4})`;
              const wr = h.trades>0?h.wins/h.trades:0;
              return <div key={i} style={{background:bg,border:`1px solid ${c.wire}`,borderRadius:4,padding:"8px 2px",textAlign:"center"}}>
                <div style={{fontSize:8,color:c.ink3}}>{String(i).padStart(2,"0")}h</div>
                <div style={{fontSize:12,fontWeight:700,color:h.pnl>=0?c.go:c.stop}}>{h.pnl>=0?"+":""}{fmt(h.pnl,3)}</div>
                <div style={{fontSize:7,color:c.ink3}}>{h.trades}g {(wr*100).toFixed(0)}%</div>
              </div>;
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
            <div>
              <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Best Hours</div>
              {[...hourly].map((h,i)=>({...h,hour:i})).sort((a,b)=>b.pnl-a.pnl).slice(0,5).map((h,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${c.wire}`,fontSize:10}}>
                  <span>{String(h.hour).padStart(2,"0")}:00 UTC</span>
                  <span style={{color:c.go,fontWeight:700}}>{fmtSol(h.pnl)}</span>
                  <span style={{color:c.ink3}}>{h.trades}g</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Worst Hours</div>
              {[...hourly].map((h,i)=>({...h,hour:i})).sort((a,b)=>a.pnl-b.pnl).slice(0,5).map((h,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${c.wire}`,fontSize:10}}>
                  <span>{String(h.hour).padStart(2,"0")}:00 UTC</span>
                  <span style={{color:c.stop,fontWeight:700}}>{fmtSol(h.pnl)}</span>
                  <span style={{color:c.ink3}}>{h.trades}g</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day of week split */}
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginTop:20,marginBottom:8}}>Performance by Day of Week</div>
          <SplitTable data={daySplits}/>
        </div>}

        {/* ── GAME LOG ── */}
        {tab==="log"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>📋 Full Trade Log — {trades.length} Games</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
              <thead><tr style={{borderBottom:`1px solid ${c.wire2}`}}>
                {[{k:"ts",l:"Date"},{k:"sym",l:"Token"},{k:"walletTier",l:"Tier"},{k:"walletRank",l:"W#"},{k:"sizeSol",l:"Size"},{k:"pnlPct",l:"PnL%"},{k:"pnlSol",l:"PnL◎"},{k:"maxRoi",l:"Peak"},{k:"holdSecs",l:"Hold"},{k:"exitReason",l:"Exit"},{k:"hmmRegime",l:"Regime"}].map(h=>(
                  <th key={h.k} onClick={()=>setLogSort(s=>({key:h.k,asc:s.key===h.k?!s.asc:false}))} style={{padding:"5px 4px",textAlign:"left",color:logSort.key===h.k?c.data:c.ink3,fontSize:7,letterSpacing:0.8,textTransform:"uppercase",whiteSpace:"nowrap",cursor:"pointer"}}>
                    {h.l}{logSort.key===h.k?(logSort.asc?" ▲":" ▼"):""}
                  </th>
                ))}
              </tr></thead>
              <tbody>{sortedLog.slice(0,100).map((t,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${c.wire}`,borderLeft:`2px solid ${t.isWin?c.go:c.stop}`}}>
                  <td style={{padding:"4px",whiteSpace:"nowrap",color:c.ink3}}>{fmtFull(t.ts)}</td>
                  <td style={{padding:"4px",fontWeight:700}}>{t.sym}</td>
                  <td style={{padding:"4px"}}><span style={{fontSize:8,fontWeight:700,color:t.walletTier==="S"?c.go:t.walletTier==="A"?c.hold:c.ink2}}>{t.walletTier}</span></td>
                  <td style={{padding:"4px",color:c.ink3}}>#{t.walletRank}</td>
                  <td style={{padding:"4px"}}>{fmt(t.sizeSol,3)}</td>
                  <td style={{padding:"4px",fontWeight:700,color:t.isWin?c.go:c.stop}}>{fmtPct(t.pnlPct)}</td>
                  <td style={{padding:"4px",color:t.isWin?c.go:c.stop}}>{fmtSol(t.pnlSol)}</td>
                  <td style={{padding:"4px",color:c.hold}}>+{fmt(t.maxRoi,0)}%</td>
                  <td style={{padding:"4px",color:c.data}}>{fmtTime(t.holdSecs)}</td>
                  <td style={{padding:"4px",color:c.ink3,fontSize:7}}>{t.exitReason}</td>
                  <td style={{padding:"4px",fontSize:7,color:t.hmmRegime==="EUPHORIA"?c.go:t.hmmRegime==="FEAR"?c.stop:c.hold}}>{t.hmmRegime}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {trades.length>100&&<div style={{textAlign:"center",padding:10,fontSize:9,color:c.ink3}}>Showing first 100 of {trades.length} trades</div>}
        </div>}

        {/* ── EQUITY CURVE ── */}
        {tab==="equity"&&<div>
          <div style={{fontSize:9,color:c.ink3,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>📈 Equity Curve</div>
          <div style={{background:c.srf,border:`1px solid ${c.wire2}`,borderRadius:6,padding:12,height:280,position:"relative",overflow:"hidden"}}>
            {(()=>{
              const pts = equityPts;
              if(!pts.length) return null;
              const maxEq = Math.max(...pts.map(p=>p.eq));
              const minEq = Math.min(...pts.map(p=>p.eq));
              const range = maxEq-minEq||1;
              const W=900,H=250;
              const points = pts.map((p,i)=>{
                const x=(i/(pts.length-1))*W;
                const y=H-((p.eq-minEq)/range)*H;
                return `${x},${y}`;
              }).join(" ");
              const fillPts = points+` ${W},${H} 0,${H}`;
              const zeroY = H-((-minEq)/range)*H;
              return <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%"}}>
                <defs>
                  <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.go} stopOpacity="0.15"/>
                    <stop offset="100%" stopColor={c.go} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke={c.wire2} strokeDasharray="4"/>
                <polygon points={fillPts} fill="url(#eqfill)"/>
                <polyline points={points} fill="none" stroke={c.go} strokeWidth="1.5"/>
                <text x="4" y={zeroY-4} fill={c.ink3} fontSize="9">0◎</text>
                <text x="4" y="12" fill={c.go} fontSize="9">{fmt(maxEq,3)}◎</text>
                <text x="4" y={H-4} fill={c.stop} fontSize="9">{fmt(minEq,3)}◎</text>
              </svg>;
            })()}
          </div>
          {/* Cumulative stats below curve */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:10}}>
            <StatCard label="Final Equity" value={fmtSol(equityPts[equityPts.length-1]?.eq)} color={equityPts[equityPts.length-1]?.eq>=0?c.go:c.stop}/>
            <StatCard label="Peak Equity" value={fmtSol(Math.max(...equityPts.map(p=>p.eq)))} color={c.go}/>
            <StatCard label="Max Drawdown" value={fmt(stats.maxDD,4)+"◎"} color={c.stop}/>
            <StatCard label="Recovery" value={fmt(stats.recovery)+"x"} color={stats.recovery>1?c.go:c.stop}/>
          </div>
        </div>}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:c.void,borderTop:`1px solid ${c.wire}`,padding:"6px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:8,color:c.ink3,zIndex:100}}>
        <span>MCHPai TRENCH Analytics — {stats.total} trades analyzed</span>
        <span>Paste real data via <span style={{color:c.data}}>pumpForecast()</span> export</span>
      </div>
    </div>
  );
}
