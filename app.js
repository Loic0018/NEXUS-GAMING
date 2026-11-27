const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".game-card");
const search = document.getElementById("gameSearch");
const emptyState = document.getElementById("emptyState");
let activeFilter = "all";
function updateGames() {
  const term = search.value.trim().toLowerCase(); let visible = 0;
  cards.forEach(card => { const show = (activeFilter === "all" || card.dataset.category === activeFilter) && card.dataset.name.includes(term); card.hidden = !show; if (show) visible++; });
  emptyState.hidden = visible !== 0;
}
filters.forEach(button => button.addEventListener("click", () => { filters.forEach(item => item.classList.remove("active")); button.classList.add("active"); activeFilter = button.dataset.filter; updateGames(); }));
search.addEventListener("input", updateGames);

const dialog = document.getElementById("profileDialog");
const authForms = document.getElementById("authForms");
const playerProfile = document.getElementById("playerProfile");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const usernameField = document.getElementById("usernameField");
const authPassword = document.getElementById("authPassword");
let authMode = "login";
let supabaseClient = null;
const config = window.NEXUS_SUPABASE_CONFIG || {};
if (window.supabase && config.url && config.anonKey && !config.url.includes("TON-PROJET") && !config.anonKey.includes("TA_CLE")) {
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
}
function showMessage(message, isError=false) { authMessage.textContent = message; authMessage.classList.toggle("error", isError); }
function setMode(mode) {
  authMode = mode; usernameField.hidden = mode !== "signup";
  document.querySelectorAll(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.getElementById("authTitle").innerHTML = mode === "signup" ? 'REJOINS LE <span>NEXUS.</span>' : 'ESPACE <span>JOUEUR.</span>';
  document.getElementById("authSubmit").innerHTML = mode === "signup" ? 'Créer mon compte <span>→</span>' : 'Se connecter <span>→</span>';
  authPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
  showMessage("");
}
async function ensurePlayerProfile(user) {
  const preferredName = user.user_metadata?.username || user.email?.split("@")[0] || "Joueur";
  const {data: existing, error: readError} = await supabaseClient
    .from("player_profiles").select("id, username").eq("id", user.id).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const {data: created, error: insertError} = await supabaseClient
    .from("player_profiles").insert({id: user.id, username: preferredName}).select("id, username").single();
  if (insertError) throw insertError;
  return created;
}
function renderProfile(user, profileUsername = null) {
  if (!user) { authForms.hidden = false; playerProfile.hidden = true; return; }
  const name = profileUsername || user.user_metadata?.username || user.email?.split("@")[0] || "Joueur";
  document.getElementById("profileName").textContent = name;
  document.getElementById("profileEmail").textContent = user.email || "";
  document.getElementById("profileUsername").value = name;
  document.getElementById("profileAvatarFallback").textContent = name.slice(0,1).toUpperCase();
  authForms.hidden = true; playerProfile.hidden = false;
  document.getElementById("authTitle").innerHTML = 'TON <span>PROFIL.</span>';
}
async function loadPlayerDashboard(user) {
  const {data: profile, error} = await supabaseClient.from("player_profiles").select("username, avatar_url, xp, matches_played, wins").eq("id",user.id).single();
  if (error) throw error;
  renderProfile(user,profile.username);
  const photo=document.getElementById("profileAvatar"), fallback=document.getElementById("profileAvatarFallback");
  if(profile.avatar_url){photo.src=profile.avatar_url;photo.hidden=false;fallback.hidden=true;}else{photo.hidden=true;fallback.hidden=false;}
  document.getElementById("statXp").textContent=Number(profile.xp||0).toLocaleString("fr-FR");
  document.getElementById("statMatches").textContent=profile.matches_played||0;
  document.getElementById("statWins").textContent=profile.wins||0;
  const {data:history,error:historyError}=await supabaseClient.from("game_history").select("game_name,result,xp_earned,played_at").eq("player_id",user.id).order("played_at",{ascending:false}).limit(10);
  if(historyError) throw historyError;
  const box=document.getElementById("matchHistory");box.replaceChildren();
  if(!history.length){box.innerHTML='<p class="history-empty">Aucune partie enregistrée pour le moment.</p>';return;}
  history.forEach(match=>{const row=document.createElement("div");row.className="history-row";const info=document.createElement("span");const game=document.createElement("strong");game.textContent=match.game_name;const date=document.createElement("small");date.textContent=new Date(match.played_at).toLocaleDateString("fr-FR");info.append(game,date);const result=document.createElement("span");result.className="history-result"+(match.result==="Défaite"?" loss":"");result.textContent=match.result+" · "+(match.xp_earned>=0?"+":"")+match.xp_earned+" XP";row.append(info,result);box.append(row);});
}
async function loadLiveRanking() {
  const target=document.getElementById("liveRanking");
  try{
    const {data,error}=await supabaseClient.from("player_profiles").select("username,avatar_url,xp").order("xp",{ascending:false}).limit(10);
    if(error) throw error;target.replaceChildren();
    if(!data.length){target.innerHTML='<p class="ranking-empty">Aucun joueur classé pour le moment.</p>';return;}
    data.forEach((player,index)=>{const row=document.createElement("div");row.className="rank-row";const who=document.createElement("div");who.className="rank-player";const rank=document.createElement("b");rank.className="rank-number"+(index===0?" first":"");rank.textContent=String(index+1).padStart(2,"0");let avatar;if(player.avatar_url){avatar=document.createElement("img");avatar.className="ranking-player-avatar";avatar.src=player.avatar_url;avatar.alt="";}else{avatar=document.createElement("span");avatar.className="ranking-player-initial";avatar.textContent=player.username.slice(0,1).toUpperCase();}const details=document.createElement("span");const username=document.createElement("strong");username.textContent=player.username;const label=document.createElement("small");label.textContent="Joueur NEXUS";details.append(username,label);who.append(rank,avatar,details);const game=document.createElement("span");game.className="rank-game";game.textContent="NEXUS";const xp=document.createElement("strong");xp.className="rank-points";xp.textContent=Number(player.xp||0).toLocaleString("fr-FR")+" XP";row.append(who,game,xp);target.append(row);});
  }catch(error){target.innerHTML='<p class="ranking-empty">Le classement sera disponible après la configuration des profils.</p>';}
}
document.getElementById("profileButton").addEventListener("click", async () => {
  dialog.showModal();
  if (!supabaseClient) { showMessage("Configuration nécessaire : ajoute l’URL et la clé publique de ton projet Supabase dans supabase-config.js.", true); return; }
  const {data:{session}} = await supabaseClient.auth.getSession();
  if(session?.user){try{await loadPlayerDashboard(session.user);}catch(error){renderProfile(session.user);showMessage("Erreur de chargement du profil : "+error.message,true);}}else renderProfile(null);
});
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.querySelectorAll(".auth-tab").forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) { showMessage("Le service de comptes n’est pas encore configuré. Nous allons le connecter à Supabase à l’étape suivante.", true); return; }
  const email = document.getElementById("authEmail").value.trim();
  const password = authPassword.value;
  const username = document.getElementById("authUsername").value.trim();
  const submit = document.getElementById("authSubmit"); submit.disabled = true; showMessage("Connexion en cours…");
  try {
    if (authMode === "signup") {
      if (username.length < 3) throw new Error("Choisis un pseudo d’au moins 3 caractères.");
      const {data,error} = await supabaseClient.auth.signUp({email,password,options:{data:{username}}});
      if (error) throw error;
      if (data.session) {
        await ensurePlayerProfile(data.user);
        await loadPlayerDashboard(data.user);
        showMessage("Compte créé avec succès !");
      }
      else showMessage("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
    } else {
      const {data,error} = await supabaseClient.auth.signInWithPassword({email,password});
      if (error) throw error;
      await ensurePlayerProfile(data.user);
      await loadPlayerDashboard(data.user);
      showMessage("Connexion réussie !");
    }
  } catch(error) { showMessage(error.message || "Une erreur est survenue.", true); }
  finally { submit.disabled = false; }
});
document.getElementById("signOut").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const {error} = await supabaseClient.auth.signOut();
  if (error) { showMessage(error.message,true); return; }
  setMode("login"); renderProfile(null); showMessage("Tu es déconnecté.");
});
if(supabaseClient){supabaseClient.auth.onAuthStateChange((_event,session)=>{if(dialog.open&&!session?.user)renderProfile(null);});loadLiveRanking();}
document.getElementById("profileEditForm").addEventListener("submit",async event=>{event.preventDefault();const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;const username=document.getElementById("profileUsername").value.trim();const message=document.getElementById("profileMessage");if(username.length<3||username.length>20){message.textContent="Le pseudo doit contenir entre 3 et 20 caractères.";return;}const {error}=await supabaseClient.from("player_profiles").update({username}).eq("id",user.id);if(error){message.textContent=error.message;return;}await supabaseClient.auth.updateUser({data:{username}});document.getElementById("profileName").textContent=username;document.getElementById("profileAvatarFallback").textContent=username.slice(0,1).toUpperCase();message.textContent="Pseudo mis à jour !";loadLiveRanking();});
document.getElementById("avatarInput").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;const message=document.getElementById("profileMessage");if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>2*1024*1024){message.textContent="Choisis une image JPG, PNG ou WebP de 2 Mo maximum.";return;}const {data:{user}}=await supabaseClient.auth.getUser();const ext=file.name.split(".").pop().toLowerCase();const path=user.id+"/avatar."+ext;const {error:uploadError}=await supabaseClient.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type});if(uploadError){message.textContent=uploadError.message;return;}const {data}=supabaseClient.storage.from("avatars").getPublicUrl(path);const url=data.publicUrl+"?v="+Date.now();const {error:updateError}=await supabaseClient.from("player_profiles").update({avatar_url:url}).eq("id",user.id);if(updateError){message.textContent=updateError.message;return;}await loadPlayerDashboard(user);message.textContent="Photo de profil mise à jour !";loadLiveRanking();});

document.getElementById("menuToggle").addEventListener("click", () => document.querySelector(".main-nav").classList.toggle("open"));
document.querySelectorAll(".main-nav a").forEach(link => link.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open")));
document.querySelectorAll(".tournament-join").forEach(button => button.addEventListener("click", () => alert("Les inscriptions aux tournois NEXUS seront bientôt disponibles. Reste connecté !")));
