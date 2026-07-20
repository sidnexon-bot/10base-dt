/* ==============================================================
   10base DT — AUTH.JS
   Google Identity Services (tlačítko, bez Firebase popupu — to
   je to, co dřív spouštělo COOP window.closed warning) →
   credential se vymění za Firebase Auth session →
   actorsByUid brána → role/actorIds z `actors` podle e-mailu.
   Session žije v sessionStorage (10dt_user/10dt_token), stejný
   kontrakt jako sdílený auth.js v 10base (getUser/getToken/
   require/logout).
================================================================== */

const Auth = {

  /* ---------- kontrakt shodný s 10base ---------- */

  getUser(){
    const raw = sessionStorage.getItem("10dt_user")
    return raw ? JSON.parse(raw) : null
  },

  getToken(){
    return sessionStorage.getItem("10dt_token")
  },

  // allowedRoles: např. ['ADMIN','MEMBER'] nebo null = kdokoli přihlášený
  require(allowedRoles = null){
    const user = this.getUser()
    if(!user){
      window.location.href = "login.html"
      return null
    }
    if(allowedRoles && !allowedRoles.includes(user.role)){
      window.location.href = "login.html"
      return null
    }
    return user
  },

  logout(){
    firebase.auth().signOut().catch(() => {})
    sessionStorage.removeItem("10dt_user")
    sessionStorage.removeItem("10dt_token")
    window.location.href = "login.html"
  },

  /* ---------- Google Identity Services → Firebase Auth ---------- */

  // Zavoláno z login.html jako data-callback GIS tlačítka
  async handleCredentialResponse(response){
    try{
      const credential = firebase.auth.GoogleAuthProvider.credential(response.credential)
      const result = await firebase.auth().signInWithCredential(credential)
      const ok = await Auth._loadSession(result.user)

      if(!ok){
        alert(
          "Tenhle účet ještě nemá přístup.\n\n" +
          "Pošli tohle UID adminovi, ať tě přidá do actorsByUid:\n\n" +
          result.user.uid
        )
        await firebase.auth().signOut()
        return
      }

      window.location.href = "index.html"
    }catch(err){
      console.error("Přihlášení selhalo:", err)
      alert("Přihlášení se nezdařilo: " + (err?.message || err))
    }
  },

  /* -----------------------------------------------------------
     1) brána: actorsByUid/{uid} musí existovat (plochý boolean)
     2) najdi v `actors` záznam(y) podle e-mailu (rodič = sebe + dítě)
     3) role = ADMIN pokud je mezi shodami alespoň jeden ADMIN
  ----------------------------------------------------------- */
  async _loadSession(fbUser){
    try{
      const gateSnap = await db.ref("actorsByUid/" + fbUser.uid).once("value")
      if(!gateSnap.exists()) return false
    }catch(err){
      return false // permission-denied = uid v actorsByUid neexistuje
    }

    const actorsSnap = await db.ref("actors").once("value")
    const actors = actorsSnap.val() || {}
    const email  = fbUser.email

    const matches = Object.entries(actors).filter(([id, a]) =>
      a.email === email || a.guardianEmail === email
    )

    let role = "MEMBER"
    if(matches.some(([id, a]) => (a.role || "").toUpperCase() === "ADMIN")){
      role = "ADMIN"
    }

    const user = {
      uid: fbUser.uid,
      email,
      name: fbUser.displayName || email,
      photoURL: fbUser.photoURL || null,
      role,
      actorIds: matches.map(([id]) => id)
    }

    const token = await fbUser.getIdToken()

    sessionStorage.setItem("10dt_user", JSON.stringify(user))
    sessionStorage.setItem("10dt_token", token)
    return true
  }
}

window.Auth = Auth
window.handleCredentialResponse = (response) => Auth.handleCredentialResponse(response)
