/* ==============================================================
   10base DT — AUTH.JS
   Google přihlášení (Firebase Auth) + brána přes actorsByUid,
   stejně jako 10base: actorsByUid/{uid} je jen plochý boolean
   flag (true), žádný pointer ani role. Jakmile appka projde
   bránou (uid v actorsByUid existuje), smí číst celý `actors`
   seznam a v něm si sama najde záznam(y) podle e-mailu — přesně
   jak to má 10base s `members`.
   .write: false na actorsByUid/actorsByEmail — přidání nového
   uid je ruční admin úkon v RTDB konzoli, appka tam nikdy nepíše.
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
     1) zkontroluj bránu: actorsByUid/{uid} musí existovat
     2) pokud ano, appka smí číst `actors` — najdi v něm všechny
        záznamy, kde email nebo guardianEmail sedí na přihlašovací
        e-mail (rodič tak "odemkne" i sebe, i dítě)
     3) role se bere ze shod — pokud je mezi nimi ADMIN, vyhrává
  ----------------------------------------------------------- */
  async _loadSession(fbUser){
    try{
      const gateSnap = await db.ref("actorsByUid/" + fbUser.uid).once("value")
      if(!gateSnap.exists()) return false
    }catch(err){
      // permission-denied = uid v actorsByUid neexistuje
      return false
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

    const session = {
      uid: fbUser.uid,
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
