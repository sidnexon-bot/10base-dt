/* ==============================================================
   10base DT — FORMULÁŘ TERMÍNU (akce = představení)
   Vyžaduje: globální `db` (firebase.database()), `escapeHtml()`,
   a existující modal #eventFormModal / #eventFormModalBody z index.html
================================================================== */

window.EDIT_EVENT_DT   = {}
window.PROJECTS_DT     = {}
window.ACTORS_DT       = {}
window.WAREHOUSE_WARN  = {} // actorId -> počet po sobě jdoucích služeb do tohoto termínu

/* -----------------------------------------------------------
   OTEVŘENÍ FORMULÁŘE (nový nebo editace)
----------------------------------------------------------- */
async function openEventFormDT(id){
  window.EDIT_EVENT_DT = {}

  let event = {}
  if(id){
    const snap = await db.ref("events/" + id).once("value")
    event = snap.val() || {}
    window.EDIT_EVENT_DT = event
  }

  // načti projekty a herce (cachuj do window pro rychlé překreslování)
  const [projSnap, actorsSnap] = await Promise.all([
    db.ref("projects").once("value"),
    db.ref("actors").once("value")
  ])
  window.PROJECTS_DT = projSnap.val() || {}
  window.ACTORS_DT   = actorsSnap.val() || {}

  const isEdit = !!id

  const html = `
    <h2>${isEdit ? "Upravit termín" : "Nový termín"}</h2>
    <div class="card">
      <label>Hra<br>
        <select id="fProjectId" onchange="renderCastFieldsDT()">
          <option value="">Vyber hru</option>
          ${Object.entries(window.PROJECTS_DT).map(([pid, p]) => `
            <option value="${pid}" ${event.projectId === pid ? "selected" : ""}>${escapeHtml(p.name)}</option>
          `).join("")}
        </select>
      </label>

      <label>Datum<br>
        <input id="fDate" type="date" value="${escapeHtml(event.date || "")}">
      </label>

      <label>Čas<br>
        <input id="fTime" type="time" value="${escapeHtml(event.time || "")}">
      </label>

      <div id="castFieldsDT" style="margin-top:16px"></div>

      <div style="margin-top:20px;border-top:1px solid rgba(128,128,128,0.15);padding-top:16px">
        <div class="small" style="font-weight:600;margin-bottom:8px">🚚 Sklad — tam</div>
        <div id="warehouseOutDT"></div>
      </div>

      <div style="margin-top:16px">
        <div class="small" style="font-weight:600;margin-bottom:8px">🚚 Sklad — zpět</div>
        <div id="warehouseBackDT"></div>
      </div>

      <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
        <button onclick="saveEventDT('${isEdit ? id : ""}')" style="background:#d4f5e2;color:#1a7a3a">
          ${isEdit ? "Uložit změny" : "Vytvořit termín"}
        </button>
        <button onclick="closeEventFormModal()">Zrušit</button>
      </div>
    </div>
  `

  document.getElementById("eventFormModalBody").innerHTML = html
  document.getElementById("eventFormModal").classList.remove("hidden")

  if(event.projectId){
    await renderCastFieldsDT()
  }
}

function closeEventFormModal(){
  document.getElementById("eventFormModal").classList.add("hidden")
}

/* -----------------------------------------------------------
   OBSAZENÍ PODLE ROLÍ (dropdown jen z herců přiřazených k roli)
----------------------------------------------------------- */
async function renderCastFieldsDT(){
  const projectId = document.getElementById("fProjectId")?.value
  const wrap = document.getElementById("castFieldsDT")
  if(!wrap) return

  if(!projectId){
    wrap.innerHTML = ""
    document.getElementById("warehouseOutDT").innerHTML  = ""
    document.getElementById("warehouseBackDT").innerHTML = ""
    return
  }

  const project = window.PROJECTS_DT[projectId] || {}
  const roles   = project.roles || {}
  const cast    = window.EDIT_EVENT_DT.cast || {}

  wrap.innerHTML = `
    <div class="small" style="font-weight:600;margin-bottom:8px">Obsazení</div>
    ${Object.entries(roles).map(([roleId, role]) => `
      <label>${escapeHtml(role.name)}<br>
        <select id="fCast_${roleId}">
          <option value="">— nevybráno —</option>
          ${(role.actors || []).map(actorId => {
            const actor = window.ACTORS_DT[actorId]
            if(!actor) return ""
            const selected = cast[roleId] === actorId ? "selected" : ""
            return `<option value="${actorId}" ${selected}>${escapeHtml(actor.name)}</option>`
          }).join("")}
        </select>
      </label>
    `).join("")}
  `

  // spočítej varování "3x po sobě" pro sklad před vykreslením pickerů
  await computeWarehouseWarningsDT(projectId, window.EDIT_EVENT_DT.date)

  document.getElementById("warehouseOutDT").innerHTML  = renderWarehouseLegDT("out")
  document.getElementById("warehouseBackDT").innerHTML = renderWarehouseLegDT("back")
}

/* -----------------------------------------------------------
   VÝPOČET "NE 3X PO SOBĚ" — projde chronologicky eventy dané
   hry a spočítá, kolikrát po sobě byl každý herec ve skladu
   (kterákoliv směr) bezprostředně před tímto termínem
----------------------------------------------------------- */
async function computeWarehouseWarningsDT(projectId, beforeDate){
  window.WAREHOUSE_WARN = {}

  const snap = await db.ref("events")
    .orderByChild("projectId")
    .equalTo(projectId)
    .once("value")

  const events = Object.values(snap.val() || {})
    .filter(e => !beforeDate || e.date < beforeDate)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  // pro každého herce spočítej délku aktuální "série" služeb odzadu
  const streak = {}
  events.forEach(e => {
    const assignedHere = new Set([
      ...(e.warehouse?.out?.assigned  || []),
      ...(e.warehouse?.back?.assigned || [])
    ])
    Object.keys(window.ACTORS_DT).forEach(actorId => {
      if(assignedHere.has(actorId)){
        streak[actorId] = (streak[actorId] || 0) + 1
      }else{
        streak[actorId] = 0
      }
    })
  })

  window.WAREHOUSE_WARN = streak
}

/* -----------------------------------------------------------
   PICKER PRO JEDNU SKLADOVOU CESTU (tam / zpět)
   — checkboxy pro admin výběr dvou lidí, s badge "Nabídl se"
   a varováním pokud by šlo o 3. službu v řadě
----------------------------------------------------------- */
function renderWarehouseLegDT(leg){
  const legData    = (window.EDIT_EVENT_DT.warehouse || {})[leg] || {}
  const volunteers = legData.volunteers || {}
  const assigned   = legData.assigned   || []

  const actorsList = Object.entries(window.ACTORS_DT)

  return `
    <div id="warehouse_${leg}_list">
      ${actorsList.map(([actorId, actor]) => {
        const isVolunteer = !!volunteers[actorId]
        const isAssigned  = assigned.includes(actorId)
        const streak      = window.WAREHOUSE_WARN[actorId] || 0
        const wouldBeThird = streak >= 2 // pokud přiřadíme, bude to 3. v řadě

        return `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,0.08);font-weight:normal">
            <input type="checkbox" value="${actorId}" ${isAssigned ? "checked" : ""}
              onchange="toggleWarehouseAssignedDT('${leg}','${actorId}',this.checked)"
              style="width:auto;margin:0">
            <span style="flex:1">${escapeHtml(actor.name)}</span>
            ${isVolunteer ? `<span class="small" style="color:#1a7a3a">Nabídl se ✓</span>` : ""}
            ${wouldBeThird ? `<span class="small" style="color:#ff3b30;font-weight:600">⚠ 3× v řadě</span>` : ""}
          </label>
        `
      }).join("")}
    </div>
  `
}

function toggleWarehouseAssignedDT(leg, actorId, checked){
  if(!window.EDIT_EVENT_DT.warehouse) window.EDIT_EVENT_DT.warehouse = {}
  if(!window.EDIT_EVENT_DT.warehouse[leg]) window.EDIT_EVENT_DT.warehouse[leg] = {assigned: [], volunteers: {}}

  let assigned = window.EDIT_EVENT_DT.warehouse[leg].assigned || []
  if(checked){
    if(!assigned.includes(actorId)) assigned.push(actorId)
  }else{
    assigned = assigned.filter(id => id !== actorId)
  }
  window.EDIT_EVENT_DT.warehouse[leg].assigned = assigned

  // překresli jen tento seznam, ať se aktualizuje varování vizuálně
  document.getElementById("warehouse_" + leg + "_list").outerHTML = renderWarehouseLegDT(leg)
}

/* -----------------------------------------------------------
   ULOŽENÍ TERMÍNU
----------------------------------------------------------- */
async function saveEventDT(id){
  const projectId = document.getElementById("fProjectId")?.value
  const date       = document.getElementById("fDate")?.value
  const time        = document.getElementById("fTime")?.value

  if(!projectId){ alert("Vyber hru"); return }
  if(!date){ alert("Zadej datum"); return }

  const project = window.PROJECTS_DT[projectId] || {}
  const roles   = project.roles || {}

  const cast = {}
  Object.keys(roles).forEach(roleId => {
    const val = document.getElementById("fCast_" + roleId)?.value
    if(val) cast[roleId] = val
  })

  const warehouse = {
    out:  window.EDIT_EVENT_DT.warehouse?.out  || {assigned: [], volunteers: {}},
    back: window.EDIT_EVENT_DT.warehouse?.back || {assigned: [], volunteers: {}}
  }

  const payload = {date, time, projectId, cast, warehouse}

  try{
    if(id){
      await db.ref("events/" + id).update(payload)
    }else{
      await db.ref("events").push(payload)
    }
    closeEventFormModal()
    if(typeof renderEventsDT === "function") renderEventsDT()
  }catch(err){
    alert("Chyba při ukládání: " + (err?.message || err))
  }
}

window.openEventFormDT          = openEventFormDT
window.closeEventFormModal      = closeEventFormModal
window.renderCastFieldsDT       = renderCastFieldsDT
window.toggleWarehouseAssignedDT = toggleWarehouseAssignedDT
window.saveEventDT              = saveEventDT
