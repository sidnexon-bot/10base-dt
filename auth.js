/* ==============================================================
   10base DT — AUTH.JS
   Google přihlášení (Firebase Auth) + kontrola přes actorsByUid —
   stejný mechanismus jako 10base (membersByUid): index je čtený
   přímo podle auth.uid, .write je v rules zakázaný i pro appku
   samotnou — záznam do actorsByUid/{uid} přidává admin ručně
   přes RTDB konzoli poté, co se dotyčný jednou přihlásí a appka
   mu ukáže jeho uid.
================================================================== */

const Auth = {

  async login(){
    const provider = new firebase.auth.GoogleAuthProvider()
    try{
      const result = await firebase.auth().signInWithPopup(provider)
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

  async logout(){
    try{ await firebase.auth().signOut() }catch(e){}
    localStorage.removeItem("10dt_user")
    window.location.href = "login.html"
  },

  /* -----------------------------------------------------------
     actorsByUid/{uid} = {role, actorIds: {a1:true, a2:true}} —
     role žije přímo tady (rodič nemusí mít vlastní actors
     záznam), actorIds je seznam koho ovládá (sebe + případně dítě).
  ----------------------------------------------------------- */
  async _loadSession(fbUser){
    let entry = null
    try{
      const snap = await db.ref("actorsByUid/" + fbUser.uid).once("value")
      entry = snap.val()
    }catch(err){
      // permission-denied = záznam v actorsByUid neexistuje
      return false
    }
    if(!entry) return false

    const actorIds = Object.keys(entry.actorIds || {})

    const session = {
      uid: fbUser.uid,
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email,
      photoURL: fbUser.photoURL || null,
      role: (entry.role || "MEMBER").toUpperCase(),
      actorIds
    }
    localStorage.setItem("10dt_user", JSON.stringify(session))
    return true
  }
}

window.Auth = Auth
