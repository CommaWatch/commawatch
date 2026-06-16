// CommaWatch shared core — single source of truth for roster, holdings, and net-worth math.
// Loaded by BOTH the public page (index.html) and the internal studio (studio.html) so the
// numbers and Day price logic never diverge. Everything here is a plain global (also grouped
// under window.CW for clarity). Keep this side-effect free — no DOM, no fetch.

// base prices per ticker (demo, ~June 2026 plausible levels) — used as the simulator seed
// and as the fallback when a live quote isn't available for a ticker.
var PRICES = { ORCL:185, TSLA:425, META:660, NVDA:205, MSFT:420, "BRK.B":490, AMZN:250, SPCX:150 };

// roster with full holdings — live (public, ticks) + static (private, est.)
var ROSTER = [
  {id:"ellison", name:"Larry Ellison", co:"Oracle", tk:"ORCL · TSLA", conf:4,
   note:"Also holds a Paramount Skydance (PSKY) stake; ~⅓ of his Oracle shares are pledged as loan collateral.",
   holdings:[
     {label:"Oracle", ticker:"ORCL", shares:1.16e9, kind:"live"},
     {label:"Tesla", ticker:"TSLA", shares:45e6, kind:"live"},
     {label:"Real estate — Lanai island + estates", value:4e9, kind:"realestate", src:"Est. from public records"},
     {label:"Sports & media — Indian Wells, SailGP", value:2e9, kind:"sports", src:"Estimate"}
   ]},
  {id:"bezos", name:"Jeff Bezos", co:"Amazon", tk:"AMZN", conf:4,
   note:"Non-Amazon assets are private estimates; Blue Origin has no market price, so its value is an analyst range.",
   holdings:[
     {label:"Amazon", ticker:"AMZN", shares:8.83e8, kind:"live"},
     {label:"Blue Origin", value:50e9, kind:"private", src:"Private — analyst est. $50–100B"},
     {label:"The Washington Post", value:1.4e9, kind:"private", src:"via Nash Holdings"},
     {label:"Ventures, real estate & Koru yacht", value:4e9, kind:"private", src:"Bezos Expeditions, est."}
   ]},
  {id:"zuck", name:"Mark Zuckerberg", co:"Meta", tk:"META", conf:5,
   note:"~95% of his fortune is Meta; controls ~61% of voting power via Class B shares.",
   holdings:[
     {label:"Meta Platforms", ticker:"META", shares:3.45e8, kind:"live"},
     {label:"Real estate — Kauai, Palo Alto, Miami", value:0.5e9, kind:"realestate", src:"Est. ~$450–500M"},
     {label:"Launchpad superyacht", value:0.3e9, kind:"private", src:"Estimate"}
   ]},
  {id:"musk", name:"Elon Musk", co:"Tesla · SpaceX", tk:"TSLA · SPCX", conf:4,
   note:"SpaceX/xAI/X went public as SPCX on Jun 12, 2026, repricing his stake past $1T. Net worth includes his vested in-the-money options (Tesla 2018 award + SPCX), counted the way Forbes and Bloomberg do.",
   holdings:[
     {label:"Tesla — common shares", ticker:"TSLA", shares:4.10e8, kind:"live"},
     {label:"Tesla — 2018 award options", ticker:"TSLA", shares:3.03e8, strike:23.34, kind:"live"},
     {label:"SpaceX · xAI · X", ticker:"SPCX", shares:4.77e9, kind:"live"},
     {label:"SpaceX — vested options", ticker:"SPCX", shares:3.5e8, strike:8.40, kind:"live"},
     {label:"Neuralink", value:9e9, kind:"private", src:"~majority, $9B Series E"},
     {label:"The Boring Company", value:5.7e9, kind:"private", src:"~90%, $5.7B"}
   ]},
  {id:"ballmer", name:"Steve Ballmer", co:"Microsoft", tk:"MSFT", conf:4,
   note:"Microsoft share count is from his last required disclosure in 2014, assumed unchanged since.",
   holdings:[
     {label:"Microsoft", ticker:"MSFT", shares:3.33e8, kind:"live"},
     {label:"LA Clippers", value:6.72e9, kind:"sports", src:"Sportico, Oct 2025"},
     {label:"Intuit Dome arena", value:2e9, kind:"private", src:"~construction cost"},
     {label:"The Forum + cash & investments", value:3.9e9, kind:"cash", src:"Est. (incl. $400M Forum)"}
   ]},
  {id:"huang", name:"Jensen Huang", co:"NVIDIA", tk:"NVDA", conf:5,
   note:"~3.6% of Nvidia; the remainder of his fortune is diversified investments not itemized here.",
   holdings:[
     {label:"NVIDIA", ticker:"NVDA", shares:8.80e8, kind:"live"}
   ]},
  {id:"buffett", name:"Warren Buffett", co:"Berkshire", tk:"BRK.B", conf:5,
   note:"Holds mostly Class A (converted here to B-equivalent); donates large blocks to charity each year.",
   holdings:[
     {label:"Berkshire Hathaway", ticker:"BRK.B", shares:2.85e8, kind:"live"}
   ]}
];

// ---------- net-worth math ----------
// Net worth = Σ(live holding value at a chosen price) + static private estimates.
// Options are valued as max(0, price − strike) × shares; plain holdings as shares × price.
function liveH(p){return p.holdings.filter(function(h){return h.kind==="live";});}
function staticTotal(p){return p.holdings.filter(function(h){return h.kind!=="live";}).reduce(function(s,h){return s+(h.value||0);},0);}
function holdVal(h,price){return h.strike!=null?Math.max(0,(price-h.strike))*h.shares:h.shares*price;}
// pick(ticker) -> price to use for that ticker. This is the single net-worth function both
// pages call; the only thing that varies is which price `pick` returns (live `c`, prev `pc`, etc.).
function nwAt(p,pick){var s=staticTotal(p);liveH(p).forEach(function(h){s+=holdVal(h,pick(h.ticker));});return s;}

// unique set of live tickers across the whole roster
function allTickers(){var set={};ROSTER.forEach(function(p){liveH(p).forEach(function(h){set[h.ticker]=1;});});return Object.keys(set);}

// ---------- number formatting ----------
// withCommas wraps every thousands separator in <span class="cm">,</span> — the signature
// glowing-comma treatment. money abbreviates to M/B/T like the main profile number.
function withCommas(n){return Math.round(n).toLocaleString('en-US').replace(/,/g,'<span class="cm">,</span>');}
function money(n){var a=Math.abs(n),sg=n<0?"-":"";
  if(a>=1e12)return sg+"$"+(a/1e12).toFixed(2)+"T";
  if(a>=1e9)return sg+"$"+(a/1e9).toFixed(2)+"B";
  if(a>=1e6)return sg+"$"+(a/1e6).toFixed(1)+"M";
  return sg+"$"+Math.round(a).toLocaleString('en-US');}

// ---------- market status (US, ET) ----------
function marketStatus(){
  var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date());
  var o={};p.forEach(function(x){o[x.type]=x.value;});
  var mins=parseInt(o.hour,10)*60+parseInt(o.minute,10);
  var isWeekday=["Mon","Tue","Wed","Thu","Fri"].indexOf(o.weekday)>=0;
  return {open:isWeekday && mins>=570 && mins<960};
}

if (typeof window !== "undefined") {
  window.CW = {
    PRICES: PRICES, ROSTER: ROSTER,
    liveH: liveH, staticTotal: staticTotal, holdVal: holdVal, nwAt: nwAt, allTickers: allTickers,
    withCommas: withCommas, money: money, marketStatus: marketStatus
  };
}
