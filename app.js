/* ==============================================================
   10base DT — APP.JS (kostra)
   Řídicí soubor: session, navigace mezi taby, dark mode, obecné
   modal helpery. renderDashboardDT/renderEventsDT jsou zatím
   stub — naplníme daty v dalším kroku. renderActorsDT už je
   plně funkční (viz divadlo-actors-admin.js).
================================================================== */

let ACTOR_EMAIL = null   // e-mail přihlášeného uživatele (jeho vlastní, ne dítěte)
let ACTOR_NAME  = null
let ACTOR_ROLE  = "MEMBER" // MEMBER | ADMIN
let AUTH_ROLE   = null     // originální role při přihlášení, nemění se
let ACTIVE_TAB  = "dashboard"

const isDesktop = window.innerWidth >= 1025

/* ===============================
   SESSION
================================ */

function initActorFromSession(){
  const user = Auth.require() // redirects to login.html if missing
  if(!user) return false

  ACTOR_EMAIL = user.email
  ACTOR_NAME  = user.name
  ACTOR_ROLE  = (user.role || "MEMBER").toUpperCase()
  AUTH_ROLE   = ACTOR_ROLE

  updateProfileBtn()
  return true
}

function updateProfileBtn(){
  const profileBtn = document.getElementById("profileBtn")
  const user = Auth.getUser()
  if(profileBtn){
    if(user?.photoURL){
      profileBtn.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    }else{
      profileBtn.textContent = getInitials(ACTOR_NAME)
    }
    if(user){
      document.getElementById("profileMenuName").textContent  = user.name
      document.getElementById("profileMenuEmail").textContent = user.email
      document.getElementById("profileMenuRole").textContent  = user.role
    }
  }

  const menuActors = document.getElementById("profileMenuActors")
  if(menuActors){
    if(AUTH_ROLE === "ADMIN") menuActors.classList.remove("hidden")
    else menuActors.classList.add("hidden")
  }
}

/* ===============================
   HELPERY (beze změny oproti 10base)
================================ */

function getInitials(name){
  if(!name) return "?"
  return name.split(" ").map(n => n[0]).join("").toUpperCase()
}

function escapeHtml(str){
  if(!str) return ""
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function formatDate(d){
  if(!d) return ""
  const date = new Date(d)
  return date.toLocaleDateString("cs-CZ", {weekday: "short", day: "numeric", month: "numeric", year: "numeric"})
}

function formatTime(t){
  if(!t) return ""
  return String(t).substring(0, 5)
}

function container(){
  return document.getElementById("main")
}

function setLoading(){
  container().innerHTML = `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line tall"></div>
      <div class="skeleton skeleton-line medium"></div>
      <div class="skeleton skeleton-line short"></div>
    </div>
  `
}

function setError(msg){
  container().innerHTML = "<p class='notice'>" + escapeHtml(msg) + "</p>"
}

function closeProfileMenu(){
  document.getElementById("profileMenu")?.classList.add("hidden")
}

/* ===============================
   DARK MODE
================================ */

function initDarkMode(){
  const saved = localStorage.getItem("darkMode")
  if(saved === "1") applyDarkMode(true)
}

function applyDarkMode(on){
  document.body.classList.toggle("dark", on)
  const btn = document.getElementById("darkModeToggle")
  if(btn) btn.textContent = on ? "☀️ Světlý režim" : "🌙 Tmavý režim"
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if(meta) meta.content = on ? "#1c1c1e" : "#f2f2f7"
  updateSidebarDarkLabel()
}

function toggleDarkMode(){
  const isDark = document.body.classList.contains("dark")
  applyDarkMode(!isDark)
  localStorage.setItem("darkMode", isDark ? "0" : "1")
  closeProfileMenu()
}

function updateSidebarDarkLabel(){
  const label = document.getElementById("sidebarDarkLabel")
  if(label) label.textContent = document.body.classList.contains("dark") ? "Světlý režim" : "Tmavý režim"
}

/* ===============================
   NAVIGACE MEZI TABY
================================ */

function setActiveTabDT(name){
  ACTIVE_TAB = name

  document.querySelectorAll(".bottom button").forEach(b => b.classList.remove("active"))
  const map = {dashboard: "btnDashboard", events: "btnEvents", actors: "btnActors"}
  document.getElementById(map[name])?.classList.add("active")
  updateSidebarActive(name)

  if(name === "dashboard") renderDashboardDT()
  if(name === "events")    renderEventsDT()
  if(name === "actors")    renderActorsDT()
}

function updateSidebarActive(tab){
  const map = {dashboard: "sidebarDashboard", events: "sidebarEvents", actors: "sidebarActors"}
  document.querySelectorAll(".sidebar-nav-item").forEach(b => b.classList.remove("active"))
  document.getElementById(map[tab])?.classList.add("active")
}

/* ===============================
   SIDEBAR (desktop)
================================ */

function initSidebar(){
  const sidebar = document.getElementById("sidebar")
  if(!sidebar) return

  if(window.innerWidth >= 768) sidebar.style.display = "flex"
  window.addEventListener("resize", () => {
    sidebar.style.display = window.innerWidth >= 768 ? "flex" : "none"
  })

  document.getElementById("sidebarAvatar").textContent = getInitials(ACTOR_NAME)
  document.getElementById("sidebarName").textContent   = ACTOR_NAME || "—"
  document.getElementById("sidebarRole").textContent   = ACTOR_ROLE || "—"

  if(AUTH_ROLE === "ADMIN"){
    document.getElementById("sidebarActors")?.classList.remove("hidden")
    document.getElementById("btnActors")?.classList.remove("hidden")
  }

  document.getElementById("sidebarDashboard").onclick = () => setActiveTabDT("dashboard")
  document.getElementById("sidebarEvents").onclick    = () => setActiveTabDT("events")
  document.getElementById("sidebarActors").onclick    = () => setActiveTabDT("actors")

  updateSidebarDarkLabel()
}

/* ===============================
   OBECNÝ FORMULÁŘ (Přidat/Upravit — beze změny oproti 10base)
   Na tomhle staví openAddActorDT/openEditActorDT z
   divadlo-actors-admin.js
================================ */

function openFormModal(title, fields, onSubmit){
  const modal     = document.getElementById("formModal")
  const titleEl   = document.getElementById("formModalTitle")
  const bodyEl    = document.getElementById("formModalBody")
  const submitBtn = document.getElementById("formModalSubmit")

  titleEl.textContent = title
  submitBtn.style.display = "" // pro případ že ho předtím skryl openAssignActorToRoleDT

  bodyEl.innerHTML = fields.map(f => `
    <label style="display:block;margin-bottom:12px">
      ${f.label}<br>
      ${f.type === "textarea"
        ? `<textarea id="fModal_${f.key}" style="width:100%;min-height:80px;margin-top:4px;border:1px solid #ddd;border-radius:6px;padding:8px;font-family:inherit;font-size:14px">${f.value || ""}</textarea>`
        : f.type === "select"
        ? `<select id="fModal_${f.key}" style="margin-top:4px">
            ${(f.options || []).map(o => `<option value="${o}" ${f.value === o ? "selected" : ""}>${o}</option>`).join("")}
           </select>`
        : `<input id="fModal_${f.key}" type="${f.type || "text"}" value="${f.value || ""}" placeholder="${f.placeholder || ""}" style="margin-top:4px">`
      }
    </label>
  `).join("")

  submitBtn.onclick = () => {
    const values = {}
    fields.forEach(f => {
      values[f.key] = document.getElementById("fModal_" + f.key)?.value.trim() || ""
    })
    onSubmit(values)
  }

  modal.classList.remove("hidden")
}

function closeFormModal(){
  document.getElementById("formModal").classList.add("hidden")
}

/* ===============================
   PŘEHLED — STUB
   TODO: nejbližší termín, kolik lidí má "Můžu" ve skladu,
   heatmapa docházky jako v 10base
================================ */

async function renderDashboardDT(){
  setLoading()
  container().innerHTML = `<h2 style="margin:0 0 12px">Přehled</h2>
    <div class="card">
      <p class="notice" style="margin:0">Zatím prázdné — naplníme daty v dalším kroku.</p>
    </div>`
}

/* ===============================
   TERMÍNY — STUB
   TODO: kalendář termínů filtrovaný podle projektů, ve kterých
   je přihlášený herec obsazen (users/{uid}/projects index),
   + tlačítko "+ Nový termín" volající openEventFormDT() pro admina
================================ */

async function renderEventsDT(){
  setLoading()
  let html = `<h2 style="margin:0 0 12px">Termíny</h2>`

  if(AUTH_ROLE === "ADMIN"){
    html += `<div class="btn-group" style="margin-bottom:16px">
      <button onclick="openEventFormDT()">+ Nový termín</button>
    </div>`
  }

  html += `<div class="card"><p class="notice" style="margin:0">Zatím prázdné — naplníme daty v dalším kroku.</p></div>`
  container().innerHTML = html
}

/* ===============================
   START
================================ */

async function start(){
  try{
    if(!initActorFromSession()) return

    initDarkMode()
    setLoading()

    const profileBtn = document.getElementById("profileBtn")
    if(profileBtn){
      profileBtn.onclick = (e) => {
        e.stopPropagation()
        document.getElementById("profileMenu").classList.toggle("hidden")
      }
    }
    document.addEventListener("click", () => closeProfileMenu())

    document.getElementById("btnDashboard").onclick = () => setActiveTabDT("dashboard")
    document.getElementById("btnEvents").onclick    = () => setActiveTabDT("events")
    document.getElementById("btnActors").onclick    = () => setActiveTabDT("actors")

    if(AUTH_ROLE === "ADMIN"){
      document.getElementById("btnActors")?.classList.remove("hidden")
    }

    initSidebar()
    setActiveTabDT("dashboard")

  }catch(err){
    setError("Chyba při načítání: " + (err?.message || err))
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // počkej až firebase-config.js inicializuje window.db
  const waitForDb = setInterval(() => {
    if(window.db){
      clearInterval(waitForDb)
      start()
    }
  }, 100)
})

window.setActiveTabDT   = setActiveTabDT
window.toggleDarkMode   = toggleDarkMode
window.closeProfileMenu = closeProfileMenu
window.openFormModal    = openFormModal
window.closeFormModal   = closeFormModal
window.escapeHtml       = escapeHtml
window.formatDate       = formatDate
window.formatTime       = formatTime
