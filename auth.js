/* ==============================================================
   10base DT — AUTH.JS
   Google přihlášení (Firebase Auth) + self-provisioning:
   při prvním loginu appka sama najde herce, kteří mají tento
   e-mail buď jako `email` (dospělý), nebo jako `guardianEmail`
   (rodič dítěte), a přidá jejich actorId do users/{uid}/actors.
   Vyžaduje: window.db (firebase-config.js), firebase-auth-compat.js
================================================================== */

const Auth = {

  async login(){
    const provider = new firebase.auth.GoogleAuthProvider()
    try{
      const result = await firebase.auth().signInWithPopup(provider)
      await Auth._afterLogin(result.user)
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
     Po úspěšném Google přihlášení:
     1) zkus najít existující users/{uid}
     2) pokud neexistuje, najdi actorId(y) podle e-mailu / guardianEmail
        a vytvoř users/{uid} = {email, name, role: "member", actors: {...}}
     3) ulož zjednodušenou session do localStorage — na tu se
        spoléhá app.js (initActorFromSession)
  ----------------------------------------------------------- */
  async _afterLogin(fbUser){
    const uid   = fbUser.uid
    const email = fbUser.email
    const name  = fbUser.displayName || email

    let userRecord = null
    const existingSnap = await db.ref("users/" + uid).once("value")

    if(existingSnap.exists()){
      userRecord = existingSnap.val()
    }else{
      const actorIds = await Auth._findMatchingActorIds(email)

      if(!actorIds.length){
        // nikdo s tímhle e-mailem v actors — vytvoř účet bez rolí,
        // admin ho pak může ručně napojit přes Správu herců
        userRecord = {email, name, role: "member", actors: {}}
      }else{
        const actorsMap = {}
        actorIds.forEach(id => { actorsMap[id] = true })
        userRecord = {email, name, role: "member", actors: actorsMap}
      }

      await db.ref("users/" + uid).set(userRecord)
    }

    const session = {
      uid,
      email,
      name: userRecord.name || name,
      photoURL: fbUser.photoURL || null,
      role: userRecord.role || "member",
      actors: userRecord.actors || {}
    }
    localStorage.setItem("10dt_user", JSON.stringify(session))
  },

  /* -----------------------------------------------------------
     Najde actorId všech herců, kde actor.email === email
     NEBO actor.guardianEmail === email (rodič + dítě zaráz)
  ----------------------------------------------------------- */
  async _findMatchingActorIds(email){
    const snap = await db.ref("actors").once("value")
    const actors = snap.val() || {}
    const matches = []

    Object.entries(actors).forEach(([id, a]) => {
      if(a.email === email || a.guardianEmail === email){
        matches.push(id)
      }
    })

    return matches
  }
}

window.Auth = Auth
