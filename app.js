// ===== Settings =====
const TIMEZONE = "Asia/Dhaka";
const lat = 23.8103;   // Dhaka (change to mosque location if you want)
const lon = 90.4125;

const PRAYERS_MAIN = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const PRAYERS_ALL  = ["Fajr","Dhuhr","Asr","Maghrib","Isha"]; // list UI like screenshot
const EXTRA = ["Sunrise","Sunset"];

const BN = {
  Fajr:"ফজর",
  Dhuhr:"যোহর",
  Asr:"আসর",
  Maghrib:"মাগরিব",
  Isha:"এশা",
  Sunrise:"সূর্যোদয়",
  Sunset:"সূর্যাস্ত",
  Jumua:"জুম্মা"
};


/* =====================================================
🕌 ARABIC PRAYER NAMES
===================================================== */

const AR = {
  Fajr:"فجر",
  Dhuhr:"ظهر",
  Asr:"عصر",
  Maghrib:"مغرب",
  Isha:"عشاء"
};

// Offsets 저장
function loadOffsets(){
  try{
    const o = JSON.parse(localStorage.getItem("prayerOffsets") || "{}");
    return { Fajr:0, Dhuhr:0, Asr:0, Maghrib:0, Isha:0, Sunrise:0, Sunset:0, Jumua:0, ...o };
  }catch{
    return { Fajr:0, Dhuhr:0, Asr:0, Maghrib:0, Isha:0, Sunrise:0, Sunset:0, Jumua:0 };
  }
}
function saveOffsets(o){ localStorage.setItem("prayerOffsets", JSON.stringify(o)); }
let OFF = loadOffsets();

let latestTimings = null;
let adhanEnabled = false;
let playedKeys = {}; // prevent repeat

// ===== Helpers =====
function fmt12(dateObj){
  return dateObj.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour:"numeric", minute:"2-digit", hour12:true });
}

// build date in Dhaka timezone from HH:MM
function buildDhakaDate(hhmm, addMin=0){
  const now = new Date();
  // get Dhaka "today" parts
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year:"numeric", month:"2-digit", day:"2-digit"
  }).formatToParts(now);
  const y = parts.find(p=>p.type==="year").value;
  const mo = parts.find(p=>p.type==="month").value;
  const da = parts.find(p=>p.type==="day").value;

  const [h,m] = hhmm.split(":").map(Number);
  // Create as UTC then interpret using offset by formatting only through TIMEZONE
  const d = new Date(`${y}-${mo}-${da}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`);
  // The above is "fake", so instead do simple minute math using local Date:
  // We'll create in local then always DISPLAY with TIMEZONE; for comparisons we use epoch ms.
  const local = new Date();
  local.setHours(h, m, 0, 0);
  local.setMinutes(local.getMinutes() + addMin);
  return local;
}

function dhakaNow(){
  // exact Dhaka now for countdown text
  return new Date(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  }).format(new Date()).replace(",", ""));
}

// Safer: use time strings for clock (always correct timezone)
function updateClock(){
  const now = new Date();

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric", minute: "2-digit", second:"2-digit",
    hour12: true
  }).format(now);

  const dateBn = new Intl.DateTimeFormat("bn-BD", {
    timeZone: TIMEZONE,
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  }).format(now);

  document.getElementById("clock").textContent = time;
  document.getElementById("date").textContent = dateBn;
}
setInterval(updateClock, 1000);
updateClock();

// ===== Audio unlock + enable =====
const adhanAudio = document.getElementById("adhanAudio");
document.getElementById("adhanBtn").onclick = async () => {
  adhanEnabled = true;

  // unlock autoplay by user gesture
  try{
    await adhanAudio.play();
    adhanAudio.pause();
    adhanAudio.currentTime = 0;
  }catch(e){}

  alert("✅ Adhan Enabled! এখন থেকে ওয়াক্ত হলে অটো বাজবে।");
};

// ===== SETTINGS SYSTEM =====

const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettings = document.getElementById("closeSettings");
const settingsGrid = document.getElementById("settingsGrid");
const resetBtn = document.getElementById("resetOffsets");

// OPEN
settingsBtn.onclick = () => {
  settingsModal.classList.add("show");
};

// CLOSE
closeSettings.onclick = () => {
  settingsModal.classList.remove("show");
};

// CLICK OUTSIDE CLOSE
settingsModal.onclick = (e) => {
  if(e.target === settingsModal){
    settingsModal.classList.remove("show");
  }
};

// RESET BUTTON
resetBtn.onclick = () => {

  OFF = {
    Fajr:0,
    Dhuhr:0,
    Asr:0,
    Maghrib:0,
    Isha:0,
    Sunrise:0,
    Sunset:0,
    Jumua:0
  };

  saveOffsets(OFF);

  renderSettings();

  if(latestTimings){
    renderUI(latestTimings);
  }
};
function renderSettings(){
  settingsGrid.innerHTML = "";
  const items = ["Fajr","Dhuhr","Asr","Maghrib","Isha","Sunrise","Sunset","Jumua"];

  items.forEach(p=>{
    const row = document.createElement("div");
    row.className = "setRow";
    row.innerHTML = `
      <div class="setName">
        <span class="bn">${BN[p]}</span>
        <span class="en">${p}</span>
      </div>
      <div class="setCtrl">
        <button class="stepBtn" data-p="${p}" data-d="-1">−</button>
        <div class="valBox" id="val_${p}">${OFF[p]} min</div>
        <button class="stepBtn" data-p="${p}" data-d="1">+</button>
      </div>
    `;
    settingsGrid.appendChild(row);
  });

  settingsGrid.querySelectorAll(".stepBtn").forEach(btn=>{
    btn.onclick = () => {
      const p = btn.getAttribute("data-p");
      const d = Number(btn.getAttribute("data-d"));
      OFF[p] = (OFF[p] || 0) + d;
      saveOffsets(OFF);
      document.getElementById(`val_${p}`).textContent = `${OFF[p]} min`;
      if(latestTimings) renderUI(latestTimings);
    };
  });
}
renderSettings();

// ===== UI render (prayer list like screenshot) =====
function renderUI(t){
  latestTimings = t;

  // sunrise/sunset
  const sunrise = addOffsetToTime(t.Sunrise, OFF.Sunrise);
  const sunset  = addOffsetToTime(t.Sunset, OFF.Sunset);
  document.getElementById("sunriseTime").textContent = sunrise;
  document.getElementById("sunsetTime").textContent = sunset;

  // Jumua: use Dhuhr time, only highlight on Friday
  const jumua = addOffsetToTime(t.Dhuhr, OFF.Jumua);
  document.getElementById("jumuaTime").textContent = jumua;

  // Build rows (Fajr..Isha)
  const list = document.getElementById("prayerList");
  list.innerHTML = "";

  const now = new Date();
  const nowDhakaStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, weekday:"long"
  }).format(now);
  const isFriday = nowDhakaStr.toLowerCase().includes("friday");

  // Determine current active prayer (like purple bar)
  // Active = last prayer that already started but next not started yet
  const schedule = {};
  PRAYERS_MAIN.forEach(p=>{
    schedule[p] = buildLocalDateFromHHMM(t[p], OFF[p]);
  });

  // find next prayer
  let next = null;
  for(const p of PRAYERS_MAIN){
    if(schedule[p].getTime() > now.getTime()){
      next = p; break;
    }
  }
  if(!next){
    // next is tomorrow Fajr (approx by +24h)
    next = "Fajr";
    schedule.Fajr = new Date(schedule.Fajr.getTime() + 24*60*60*1000);
  }

  // active prayer = previous of next
  const idx = PRAYERS_MAIN.indexOf(next);
  const active = idx === 0 ? "Isha" : PRAYERS_MAIN[idx-1];

  PRAYERS_MAIN.forEach(p=>{
    const timeStr = addOffsetToTime(t[p], OFF[p]);
    const row = document.createElement("div");
    row.className = "prRow" + (p === active ? " active" : "");
    row.innerHTML = `
     <div class="prName">
  <div class="en">${p}</div>
  <div class="ar">${AR[p]}</div>
  <div class="bn">${BN[p]}</div>
</div>
      <div class="prTime">${timeStr}</div>
      <div class="prOff">${OFF[p] ? (OFF[p] > 0 ? `+${OFF[p]}` : `${OFF[p]}`) : "+0"}</div>
    `;
    list.appendChild(row);
  });

  // Next prayer countdown bar text
  const diffMs = schedule[next].getTime() - now.getTime();
  const s = Math.max(0, Math.floor(diffMs/1000));
  const hh = Math.floor(s/3600);
  const mm = Math.floor((s%3600)/60);
  const ss = s%60;
  document.getElementById("nextPrayer").textContent =
    `পরবর্তী নামাজ: ${BN[next]} (${next}) - ${hh}h ${mm}m ${ss}s`;

  // Jumua box style (dim if not Friday)
  const jb = document.getElementById("jumuaBox");
  jb.style.opacity = isFriday ? "1" : "0.6";

  // Auto Adhan
autoAdhan(schedule);
updateProgress(schedule, next);
loadRamadanInfo(t);
}

// convert "HH:MM" to display string after offset
function addOffsetToTime(hhmm, offMin){
  const d = buildLocalDateFromHHMM(hhmm, offMin);
  return d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });
}

function buildLocalDateFromHHMM(hhmm, offMin){
  const [h,m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + (offMin || 0));
  return d;
}

function autoAdhan(schedule){
  if(!adhanEnabled) return;

 const now = new Date();
  for(const p of PRAYERS_MAIN){
    const when = schedule[p];
    const key = `${p}_${new Intl.DateTimeFormat("en-CA",{timeZone:TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}`;

    // play once when within 2 seconds of prayer time
    if(!playedKeys[key] && Math.abs(now.getTime() - when.getTime()) <= 2000){
      try{
        adhanAudio.currentTime = 0;
        adhanAudio.play();
      }catch(e){}
      playedKeys[key] = true;
    }
  }
}

// ===== Load prayer times from API =====
async function loadPrayerTimes(){
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=1`;
  const res = await fetch(url);
  const data = await res.json();
  const t = data.data.timings;

  // Hijri
  document.getElementById("hijri").textContent = "Hijri: " + data.data.date.hijri.date;

  renderUI(t);
}

loadPrayerTimes();

// refresh timings sometimes (API) + update countdown frequently
setInterval(loadPrayerTimes, 10 * 60 * 1000); // every 10 min
setInterval(() => { if(latestTimings) renderUI(latestTimings); }, 1000);


/* =========================================================
   🕌 MOSQUE SCREEN SYSTEM FEATURES
   These features do NOT modify your existing prayer logic
   They only add extra functionality safely
========================================================= */


/* =========================================================
   🖥 AUTO FULLSCREEN MODE (FOR MOSQUE TV DISPLAY)
   First click enters fullscreen so the screen looks clean
========================================================= */

document.addEventListener("click", () => {

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(()=>{});
  }

}, { once:true });



/* =========================================================
   🔋 PREVENT SCREEN SLEEP (WAKE LOCK)
   Keeps the mosque display screen always ON
========================================================= */

if ("wakeLock" in navigator){

  let wakeLock = null;

  async function enableWakeLock(){

    try{
      wakeLock = await navigator.wakeLock.request("screen");
    }catch(err){
      console.log("WakeLock error:", err);
    }

  }
document.addEventListener("click", enableWakeLock, { once:true });

  document.addEventListener("visibilitychange", () => {

    if (wakeLock !== null && document.visibilityState === "visible") {
      enableWakeLock();
    }

  });

}



/* =========================================================
   📱 MOBILE SCREEN OPTIMIZATION
   Helps the layout adapt to smaller phone screens
========================================================= */

function detectMobile(){

  if(window.innerWidth < 600){
    document.body.classList.add("mobileMode");
  }else{
    document.body.classList.remove("mobileMode");
  }

}

detectMobile();

window.addEventListener("resize", detectMobile);



/* =========================================================
   🔔 FUTURE FEATURE PLACEHOLDER
   (Iqamah countdown + voice announcements will go here)
========================================================= */

// Next features will be added below safely
// so your existing system remains untouched

/* =========================================================
   ⏳ IQAMAH COUNTDOWN TIMER
   Shows countdown after Adhan before Jamaat starts
========================================================= */

const IQAMAH_DELAY = {
  Fajr: 10,
  Dhuhr: 10,
  Asr: 10,
  Maghrib: 5,
  Isha: 10
};

let iqamahTimer = null;

function startIqamahCountdown(prayerName){

  const delayMin = IQAMAH_DELAY[prayerName];

  if(!delayMin) return;

  let seconds = delayMin * 60;

  clearInterval(iqamahTimer);

  iqamahTimer = setInterval(()=>{

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    document.getElementById("nextPrayer").textContent =
      `${BN[prayerName]} শুরু হয়েছে • ইকামাহ ${m}:${String(s).padStart(2,"0")} পরে`;

    seconds--;

    if(seconds <= 0){
      clearInterval(iqamahTimer);
      document.getElementById("nextPrayer").textContent =
        `${BN[prayerName]} জামাত শুরু`;
    }

  },1000);

}


/* =========================================================
   🔊 BANGLA VOICE ANNOUNCEMENT
   Uses browser speech engine
========================================================= */

function speakBangla(text){

  const speech = new SpeechSynthesisUtterance(text);

  speech.lang = "bn-BD";
  speech.rate = 0.9;
  speech.pitch = 1;

  speechSynthesis.speak(speech);

}


/* =========================================================
   🔔 PRAYER WARNING ANNOUNCEMENT
   Announces 5 minutes before prayer
========================================================= */

function checkPrayerAnnouncements(schedule){

  const now = new Date();

  for(const p of PRAYERS_MAIN){

    const prayerTime = schedule[p];
    const diff = prayerTime.getTime() - now.getTime();

    const minutes = Math.floor(diff / 60000);

    const key = "announce_"+p;

    if(minutes === 5 && !playedKeys[key]){

      speakBangla(`৫ মিনিট পরে ${BN[p]} নামাজ শুরু হবে`);

      playedKeys[key] = true;

    }

  }

}


/* =========================================================
   🔔 ADHAN + IQAMAH TRIGGER
========================================================= */

function enhancedAdhan(schedule){

  if(!adhanEnabled) return;

  const now = new Date();

  for(const p of PRAYERS_MAIN){

    const when = schedule[p];

    const key = `${p}_${new Intl.DateTimeFormat("en-CA",{timeZone:TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}`;

    if(!playedKeys[key] && Math.abs(now.getTime() - when.getTime()) <= 2000){

      adhanAudio.currentTime = 0;
      adhanAudio.play().catch(()=>{});

      startIqamahCountdown(p);

      playedKeys[key] = true;

    }

  }

}
/* =====================================================
🌤 DHAKA WEATHER + MOON FORECAST
===================================================== */
async function loadWeather(){

  const url =
  "https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current_weather=true&timezone=Asia%2FDhaka";

  try{

    const res = await fetch(url);
    const data = await res.json();

    const temp = data.current_weather.temperature;

    document.getElementById("weatherTemp").textContent = temp + "°C";

    let icon = "☀️";

    const code = data.current_weather.weathercode;

    if(code >= 2) icon="☁️";
    if(code >= 61) icon="🌧";
    if(code >= 80) icon="⛈";

    document.getElementById("weatherIcon").textContent = icon;

  }catch(err){

    console.log("Weather error:",err);

  }

}

/* =====================================================
🌙 MOON PHASE (LOCAL CALCULATION – NO API)
===================================================== */

function loadMoon(){

  const now = new Date();

  const synodicMonth = 29.53058867;

  const knownNewMoon = new Date("2000-01-06");

  const days = (now - knownNewMoon) / (1000*60*60*24);

  const phase = (days % synodicMonth) / synodicMonth;

  let moonIcon = "🌑";
  let moonText = "New Moon";

  if(phase > 0.05 && phase <= 0.25){
    moonIcon = "🌒";
    moonText = "Waxing Crescent";
  }
  else if(phase > 0.25 && phase <= 0.5){
    moonIcon = "🌓";
    moonText = "First Quarter";
  }
  else if(phase > 0.5 && phase <= 0.75){
    moonIcon = "🌔";
    moonText = "Waxing Gibbous";
  }
  else if(phase > 0.75){
    moonIcon = "🌕";
    moonText = "Full Moon";
  }

  const illumination = Math.round(phase * 100);

  document.getElementById("moonIcon").textContent = moonIcon;
  document.getElementById("moonText").textContent = moonText;

  document.getElementById("moonExtra").textContent =
    "Illumination: " + illumination + "%";

}

loadWeather();
loadMoon();

setInterval(loadWeather,600000);
setInterval(loadMoon,3600000);
let visibility = "কম";

if(illumination > 20) visibility = "মাঝারি";
if(illumination > 40) visibility = "ভাল";
if(illumination > 60) visibility = "খুব ভাল";

document.getElementById("moonVisibility").textContent =
"চাঁদ দেখার উপযোগিতা: " + visibility;


/* =====================================================
🌙 RAMADAN INFORMATION (BANGLA)
===================================================== */

function loadRamadanInfo(timings){

  // Sehri = Fajr time
  const sehri = addOffsetToTime(timings.Fajr, OFF.Fajr);

  // Iftar = Maghrib time
  const iftar = addOffsetToTime(timings.Maghrib, OFF.Maghrib);

  document.getElementById("sehriTime").textContent =
    "আজ সেহরি শেষ: " + sehri;

  document.getElementById("iftarTime").textContent =
    "আজ ইফতার: " + iftar;

}




/* =====================================================
📢 MOSQUE NOTICE BOARD
Edit messages here anytime
===================================================== */

const MOSQUE_MESSAGES = [
 "মসজিদে কথা বলা থেকে বিরত থাকুন",
 "নামাজের সময় মোবাইল বন্ধ রাখুন"
];

function loadMosqueMessages(){

  const box = document.getElementById("noticeContent");

  box.innerHTML = MOSQUE_MESSAGES
    .map(m => `<div>• ${m}</div>`)
    .join("");

}

loadMosqueMessages();


/* =====================================================
📊 PRAYER PROGRESS BAR
Shows % until next prayer
===================================================== */

function updateProgress(schedule, next){

  const now = new Date();

  const nextTime = schedule[next];

  const prevIndex = PRAYERS_MAIN.indexOf(next) - 1;
  const prevPrayer = prevIndex < 0 ? "Isha" : PRAYERS_MAIN[prevIndex];

  let prevTime = schedule[prevPrayer];

  if(prevIndex < 0){
    prevTime = new Date(prevTime.getTime() - 24*60*60*1000);
  }

  const total = nextTime - prevTime;
  const passed = now - prevTime;

  let percent = (passed / total) * 100;

  percent = Math.max(0, Math.min(100, percent));

  document.getElementById("progressFill").style.width = percent + "%";

  document.getElementById("progressPercent").textContent =
    Math.floor(percent) + "%";
}