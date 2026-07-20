/* ==============================================================
   10base DT — SPRÁVA HERCŮ (actors)
   Vyžaduje: globální `db`, `escapeHtml()`, `openFormModal()`,
   `closeFormModal()` (generický formulář z 10base — beze změny),
   a existující #main / container() pro vykreslení seznamu
================================================================== */

/* -----------------------------------------------------------
   SEZNAM HERCŮ
----------------------------------------------------------- */
async function renderActorsDT(){
  const container = document.getElementById("main")
  container.innerHTML = `<p class="notice">Načítám…</p>`

  try{
    const [actorsSnap, projectsSnap] = await Promise.all([
      db.ref("actors").once("value"),
      db.ref("projects").once("value")
    ])
    const actors   = actorsSnap.val()   || {}
    const projects = projectsSnap.val() || {}
    window.ACTORS_DT   = actors
    window.PROJECTS_DT = projects

    // pro zobrazení "hraje v: ..." u každého herce
    const projectsByActor = {}
    Object.entries(projects).forEach(([pid, p]) => {
      Object.values(p.roles || {}).forEach(role => {
        (role.actors || []).forEach(actorId => {
          if(!projectsByActor[actorId]) projectsByActor[actorId] = new Set()
          projectsByActor[actorId].add(p.name)
        })
      })
    })

    const sorted = Object.entries(actors).sort((a, b) =>
      String(a[1].name).localeCompare(String(b[1].name), "cs")
    )

    let html = `<h2 style="margin:0 0 16px">Herci</h2>`
    html += `<div class="btn-group" style="margin-bottom:16px">
      <button onclick="openAddActorDT()">+ Přidat herce</button>
    </div>`

    html += `<div class="card" style="padding:0">`
    sorted.forEach(([id, a], i) => {
      const border = i < sorted.length - 1 ? "border-bottom:1px solid rgba(128,128,128,0.1);" : ""
      const plays  = [...(projectsByActor[id] || [])]
      const isChild = !a.email && !!a.guardianEmail

      html += `<div style="padding:14px 16px;${border}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:15px">${escapeHtml(a.name)}</div>
            ${isChild
              ? `<div class="small">Zákonný zástupce: ${escapeHtml(a.guardianEmail)}</div>`
              : `<div class="small">${escapeHtml(a.email || "—")}</div>`}
            ${plays.length ? `<div class="small" style="margin-top:4px;color:#007aff">${plays.map(escapeHtml).join(", ")}</div>` : `<div class="small" style="margin-top:4px;color:var(--muted)">Zatím v žádné hře</div>`}
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="openEditActorDT('${id}')" style="background:#e8f0fe;color:#007aff;padding:8px 12px;font-size:13px">Upravit</button>
            <button onclick="deleteActorDT('${id}')" style="background:#fde8e8;color:#c00;padding:8px 12px;font-size:13px">Smazat</button>
          </div>
        </div>
      </div>`
    })
    html += `</div>`

    container.innerHTML = html
  }catch(err){
    container.innerHTML = `<p class="notice">Chyba při načítání herců: ${escapeHtml(err?.message || String(err))}</p>`
  }
}

/* -----------------------------------------------------------
   PŘIDAT HERCE
   — typ "Dospělý" (má vlastní e-mail) nebo "Dítě" (guardianEmail)
----------------------------------------------------------- */
function openAddActorDT(){
  openFormModal("Nový herec", [
    {key: "actorType",     label: "Typ",            type: "select", value: "Dospělý", options: ["Dospělý", "Dítě"]},
    {key: "name",          label: "Jméno",          type: "text"},
    {key: "email",         label: "E-mail (dospělý)", type: "text"},
    {key: "guardianEmail", label: "E-mail zákonného zástupce (dítě)", type: "text"}
  ], async (values) => {
    if(!values.name){ alert("Zadej jméno"); return }

    const isChild = values.actorType === "Dítě"
    if(isChild && !values.guardianEmail){ alert("Zadej e-mail zákonného zástupce"); return }
    if(!isChild && !values.email){ alert("Zadej e-mail"); return }

    const payload = {name: values.name}
    if(isChild){
      payload.guardianEmail = values.guardianEmail
    }else{
      payload.email = values.email
    }

    try{
      closeFormModal()
      await db.ref("actors").push(payload)
      renderActorsDT()
    }catch(err){
      alert("Chyba: " + (err?.message || err))
    }
  })
}

/* -----------------------------------------------------------
   UPRAVIT HERCE
----------------------------------------------------------- */
async function openEditActorDT(id){
  const snap = await db.ref("actors/" + id).once("value")
  const a = snap.val()
  if(!a) return

  const isChild = !a.email && !!a.guardianEmail

  openFormModal("Upravit herce", [
    {key: "actorType",     label: "Typ",            type: "select", value: isChild ? "Dítě" : "Dospělý", options: ["Dospělý", "Dítě"]},
    {key: "name",          label: "Jméno",          type: "text", value: a.name},
    {key: "email",         label: "E-mail (dospělý)", type: "text", value: a.email || ""},
    {key: "guardianEmail", label: "E-mail zákonného zástupce (dítě)", type: "text", value: a.guardianEmail || ""}
  ], async (values) => {
    if(!values.name){ alert("Zadej jméno"); return }

    const nowChild = values.actorType === "Dítě"
    if(nowChild && !values.guardianEmail){ alert("Zadej e-mail zákonného zástupce"); return }
    if(!nowChild && !values.email){ alert("Zadej e-mail"); return }

    const payload = {name: values.name}
    if(nowChild){
      payload.guardianEmail = values.guardianEmail
      payload.email = null
    }else{
      payload.email = values.email
      payload.guardianEmail = null
    }

    try{
      closeFormModal()
      await db.ref("actors/" + id).update(payload)
      renderActorsDT()
    }catch(err){
      alert("Chyba: " + (err?.message || err))
    }
  })
}

/* -----------------------------------------------------------
   SMAZAT HERCE
   — zároveň ho odebere ze všech rolí, kde byl přiřazený
----------------------------------------------------------- */
async function deleteActorDT(id){
  if(!confirm("Opravdu smazat tohoto herce? Bude odebrán i ze všech rolí.")) return

  try{
    const projSnap = await db.ref("projects").once("value")
    const projects = projSnap.val() || {}
    const updates = {}

    Object.entries(projects).forEach(([pid, p]) => {
      Object.entries(p.roles || {}).forEach(([rid, role]) => {
        if((role.actors || []).includes(id)){
          const newActors = role.actors.filter(a => a !== id)
          updates[`projects/${pid}/roles/${rid}/actors`] = newActors
        }
      })
    })

    updates[`actors/${id}`] = null
    await db.ref().update(updates)

    renderActorsDT()
  }catch(err){
    alert("Chyba při mazání: " + (err?.message || err))
  }
}

/* -----------------------------------------------------------
   PŘIŘAZENÍ HERCE K ROLI V PROJEKTU
   (samostatný modal — vyber projekt → roli → zaškrtni herce)
----------------------------------------------------------- */
async function openAssignActorToRoleDT(){
  const [projSnap, actorsSnap] = await Promise.all([
    db.ref("projects").once("value"),
    db.ref("actors").once("value")
  ])
  const projects = projSnap.val()   || {}
  const actors   = actorsSnap.val() || {}
  window.PROJECTS_DT = projects
  window.ACTORS_DT   = actors

  const modal   = document.getElementById("formModal")
  const titleEl = document.getElementById("formModalTitle")
  const bodyEl  = document.getElementById("formModalBody")
  const submit  = document.getElementById("formModalSubmit")

  titleEl.textContent = "Přiřadit herce k roli"

  bodyEl.innerHTML = `
    <label>Hra<br>
      <select id="assignProjectId" onchange="renderAssignRoleSelectDT()">
        <option value="">Vyber hru</option>
        ${Object.entries(projects).map(([pid, p]) => `<option value="${pid}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </label>
    <div id="assignRoleWrap" style="margin-top:12px"></div>
  `

  submit.style.display = "none" // ukládá se rovnou při zaškrtnutí

  modal.classList.remove("hidden")
}

function renderAssignRoleSelectDT(){
  const projectId = document.getElementById("assignProjectId")?.value
  const wrap = document.getElementById("assignRoleWrap")
  if(!projectId){ wrap.innerHTML = ""; return }

  const roles = window.PROJECTS_DT[projectId]?.roles || {}

  wrap.innerHTML = `
    <label>Role<br>
      <select id="assignRoleId" onchange="renderAssignActorsChecklistDT('${projectId}')">
        <option value="">Vyber roli</option>
        ${Object.entries(roles).map(([rid, r]) => `<option value="${rid}">${escapeHtml(r.name)}</option>`).join("")}
      </select>
    </label>
    <div id="assignActorsChecklist" style="margin-top:12px"></div>
  `
}

function renderAssignActorsChecklistDT(projectId){
  const roleId = document.getElementById("assignRoleId")?.value
  const checklistWrap = document.getElementById("assignActorsChecklist")
  if(!roleId){ checklistWrap.innerHTML = ""; return }

  const role = window.PROJECTS_DT[projectId].roles[roleId]
  const current = role.actors || []

  checklistWrap.innerHTML = `
    <div class="small" style="font-weight:600;margin-bottom:8px">Kdo alternuje tuto roli</div>
    ${Object.entries(window.ACTORS_DT).map(([id, a]) => `
      <label style="display:flex;align-items:center;gap:10px;padding:6px 0;font-weight:normal">
        <input type="checkbox" value="${id}" ${current.includes(id) ? "checked" : ""}
          onchange="toggleActorRoleDT('${projectId}','${roleId}','${id}',this.checked)"
          style="width:auto;margin:0">
        <span>${escapeHtml(a.name)}</span>
      </label>
    `).join("")}
  `
}

async function toggleActorRoleDT(projectId, roleId, actorId, checked){
  const path = `projects/${projectId}/roles/${roleId}/actors`
  const snap = await db.ref(path).once("value")
  let actors = snap.val() || []

  if(checked){
    if(!actors.includes(actorId)) actors.push(actorId)
  }else{
    actors = actors.filter(id => id !== actorId)
  }

  await db.ref(path).set(actors)
}

window.renderActorsDT              = renderActorsDT
window.openAddActorDT              = openAddActorDT
window.openEditActorDT             = openEditActorDT
window.deleteActorDT               = deleteActorDT
window.openAssignActorToRoleDT     = openAssignActorToRoleDT
window.renderAssignRoleSelectDT    = renderAssignRoleSelectDT
window.renderAssignActorsChecklistDT = renderAssignActorsChecklistDT
window.toggleActorRoleDT           = toggleActorRoleDT
