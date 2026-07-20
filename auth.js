/* ==============================================================
   10base DT — AUTH.JS
   Google přihlášení (Firebase Auth) + kontrola e-mailu proti
   plochému uzlu `actors` — stejný princip jako 10base a `members`:
   appka po loginu proskenuje actors a najde shodu podle email
   (dospělý) nebo guardianEmail (rodič dítěte). Bez shody = odepře.
   Vyžaduje: window.db (firebase-config.js), firebase-auth-compat.js
================================================================== */

const Auth = {

  async login(){
    const provider = new firebase.auth.GoogleAuthProvider()
    try{
      const result = await firebase.auth().signInWithPopup(provider)
      const ok = await Auth._loadSession(result.user)
      if(!ok){
        alert("Tenhle e-mail není v seznamu herců ani zákonných zástupců. Ozvi se adminovi.")
        await firebase.auth().signOut()
        return
      }
      window.location.href = "index.html"
    }catch(err){
      console.error("Přihlášení selhalo:", err)
      alert("Přihlášení se nezdařilo: " + (err?.message || err))
    }
  },

  async logout(){
    try{ await firebase.auth().signOut() }catch(e){}
    localStorage.removeItem("10dt_user")
    window.location.href = "login.html"
  },

  /* -----------------------------------------------------------
     Projde actors, najde všechny záznamy, kde email nebo
     guardianEmail sedí na přihlašovací e-mail (rodič tak
     "odemkne" i sebe, i dítě). Role se bere z prvního nalezeného
     záznamu, který má vlastní `role` pole; pokud je mezi
     shodami ADMIN, vyhrává ADMIN.
  ----------------------------------------------------------- */
  async _loadSession(fbUser){
    const snap   = await db.ref("actors").once("value")
    const actors = snap.val() || {}
    const email  = fbUser.email

    const matches = Object.entries(actors).filter(([id, a]) =>
      a.email === email || a.guardianEmail === email
    )

    if(!matches.length) return false

    let role = "MEMBER"
    if(matches.some(([id, a]) => (a.role || "").toUpperCase() === "ADMIN")){
      role = "ADMIN"
    }

    const session = {
      email,
      name: fbUser.displayName || email,
      photoURL: fbUser.photoURL || null,
      role,
      actorIds: matches.map(([id]) => id)
    }
    localStorage.setItem("10dt_user", JSON.stringify(session))
    return true
  }
}

window.Auth = Auth
