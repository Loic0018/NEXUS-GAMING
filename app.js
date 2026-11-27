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
if(supabaseClient){supabaseClient.auth.onAuthStateChange((_event,session)=>{if(dialog.open&&!session?.user)renderProfile(null);loadCyberCupRegistrations();loadAdminDashboard();});loadLiveRanking();}
document.getElementById("matchForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.getElementById("profileMessage");
  const submit = document.getElementById("matchSubmit");
  submit.disabled = true;
  message.textContent = "Enregistrement du résultat…";
  message.classList.remove("error");
  try {
    const {data:{user}, error:userError} = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Reconnecte-toi pour enregistrer une partie.");
    const game_name = document.getElementById("matchGame").value;
    const result = document.getElementById("matchResult").value;
    const {error} = await supabaseClient.from("game_history").insert({player_id:user.id, game_name, result});
    if (error) throw error;
    await loadPlayerDashboard(user);
    await loadLiveRanking();
    message.textContent = "Résultat enregistré ! Tes XP et tes statistiques sont actualisés.";
  } catch(error) {
    message.textContent = "Erreur : " + (error.message || "impossible d'enregistrer le résultat.");
    message.classList.add("error");
  } finally {
    submit.disabled = false;
  }
});
document.getElementById("profileEditForm").addEventListener("submit",async event=>{event.preventDefault();const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;const username=document.getElementById("profileUsername").value.trim();const message=document.getElementById("profileMessage");if(username.length<3||username.length>20){message.textContent="Le pseudo doit contenir entre 3 et 20 caractères.";return;}const {error}=await supabaseClient.from("player_profiles").update({username}).eq("id",user.id);if(error){message.textContent=error.message;return;}await supabaseClient.auth.updateUser({data:{username}});document.getElementById("profileName").textContent=username;document.getElementById("profileAvatarFallback").textContent=username.slice(0,1).toUpperCase();message.textContent="Pseudo mis à jour !";loadLiveRanking();});
document.getElementById("avatarInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const message = document.getElementById("profileMessage");
  message.textContent = "Envoi de la photo en cours…";
  message.classList.remove("error");
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      throw new Error("Choisis une image JPG, PNG ou WebP de 2 Mo maximum.");
    }
    const {data: {user}, error: userError} = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Reconnecte-toi avant de changer ta photo.");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/avatar." + ext;
    const {error: uploadError} = await supabaseClient.storage.from("avatars").upload(path, file, {upsert:true, contentType:file.type});
    if (uploadError) throw uploadError;
    const {data} = supabaseClient.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl + "?v=" + Date.now();
    const {error:updateError} = await supabaseClient.from("player_profiles").update({avatar_url:url}).eq("id",user.id);
    if (updateError) throw updateError;
    const photo = document.getElementById("profileAvatar");
    const fallback = document.getElementById("profileAvatarFallback");
    photo.onload = () => { photo.hidden = false; fallback.hidden = true; };
    photo.onerror = () => { message.textContent = "Photo envoyée, mais impossible de l'afficher. Vérifions le stockage Supabase."; };
    photo.src = url;
    message.textContent = "Photo envoyée !";
    loadLiveRanking();
  } catch (error) {
    message.textContent = "Erreur photo : " + (error.message || "réessaie.");
    message.classList.add("error");
  } finally {
    event.target.value = "";
  }
});

document.getElementById("menuToggle").addEventListener("click", () => document.querySelector(".main-nav").classList.toggle("open"));
document.querySelectorAll(".main-nav a").forEach(link => link.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open")));

 
// Inscriptions au Cyber Strike Cup
async function loadCyberCupRegistrations() {
  const count = document.getElementById("cyberCupCount");
  const roster = document.getElementById("teamRoster");
  if (!supabaseClient) { count.textContent = "Connecte Supabase pour voir les inscriptions."; return; }
  const {data:tournament,error:tournamentError} = await supabaseClient.from("tournaments").select("id,status").eq("slug","cyber-strike-cup").maybeSingle();
  if (tournamentError || !tournament) { count.textContent = "Tournoi indisponible pour le moment."; return; }
  const {count:total,error} = await supabaseClient.from("tournament_registrations").select("id",{count:"exact",head:true}).eq("tournament_id",tournament.id);
  if (error) { count.textContent = "Nombre d'équipes indisponible."; return; }
  count.textContent = (total || 0) + " équipe(s) inscrite(s)";
  const button = document.getElementById("cyberCupJoin");
  const status = document.getElementById("cyberCupStatus");
  if (tournament.status !== "open") {
    status.textContent = tournament.status === "completed" ? "TERMINÉ" : "INSCRIPTIONS FERMÉES";
    button.disabled = true;
    button.textContent = "Inscriptions fermées";
  }
  const {data:{user}} = await supabaseClient.auth.getUser();
  if (user) {
    const {data:mine,error:mineError} = await supabaseClient.from("tournament_registrations").select("id,team_name").eq("tournament_id",tournament.id).eq("player_id",user.id).maybeSingle();
    if (!mineError && mine) {
      roster.hidden = false;
      document.getElementById("teamRosterTitle").textContent = "COMPOSITION — " + mine.team_name.toUpperCase();
      const {data:members,error:membersError} = await supabaseClient.from("tournament_team_members").select("slot,player_name").eq("registration_id",mine.id).order("slot");
      if (!membersError) {
        members.forEach(member => { const input=document.querySelector('.team-member-input[data-slot="'+member.slot+'"]'); if(input) input.value=member.player_name; });
        const list=document.getElementById("teamRosterList"); list.replaceChildren();
        if(members.length){const heading=document.createElement("p");heading.className="team-roster-summary";heading.textContent="Joueurs enregistrés :";list.append(heading);members.forEach(member=>{const line=document.createElement("p");line.className="team-roster-player";line.textContent="Joueur "+(member.slot+1)+" · "+member.player_name;list.append(line);});}
      }
    }
  } else { roster.hidden = true; }
}
document.getElementById("cyberCupJoin").addEventListener("click", async () => {
  const feedback = document.getElementById("cyberCupFeedback");
  const button = document.getElementById("cyberCupJoin");
  feedback.textContent = "";
  feedback.classList.remove("error");
  if (!supabaseClient) { feedback.textContent = "Le service Supabase n'est pas disponible."; feedback.classList.add("error"); return; }
  button.disabled = true;
  try {
    const {data:{user},error:userError} = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      feedback.textContent = "Connecte-toi via « Espace joueur » avant d'inscrire ton équipe.";
      document.getElementById("profileButton").click();
      return;
    }
    const teamName = window.prompt("Quel est le nom de ton équipe ? (2 à 40 caractères)");
    if (teamName === null) return;
    const cleanName = teamName.trim();
    if (cleanName.length < 2 || cleanName.length > 40) throw new Error("Le nom de l'équipe doit contenir entre 2 et 40 caractères.");
    const {data:tournament,error:tournamentError} = await supabaseClient.from("tournaments").select("id,status").eq("slug","cyber-strike-cup").single();
    if (tournamentError) throw tournamentError;
    if (tournament.status !== "open") throw new Error("Les inscriptions à ce tournoi sont fermées.");
    const {error} = await supabaseClient.from("tournament_registrations").insert({tournament_id:tournament.id,player_id:user.id,team_name:cleanName});
    if (error) {
      if (error.code === "23505") throw new Error("Tu as déjà inscrit une équipe à ce tournoi.");
      throw error;
    }
    feedback.textContent = "Équipe inscrite ! Tu es enregistré comme capitaine. Les autres membres devront être ajoutés ensuite.";
    await loadCyberCupRegistrations();
  } catch(error) {
    feedback.textContent = "Erreur : " + (error.message || "inscription impossible.");
    feedback.classList.add("error");
  } finally {
    button.disabled = false;
  }
});
loadCyberCupRegistrations();


document.getElementById("teamRosterForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.getElementById("cyberCupFeedback");
  const submit = document.getElementById("saveTeamRoster");
  const inputs = [...document.querySelectorAll(".team-member-input")];
  const names = inputs.map(input => input.value.trim());
  message.textContent = "";
  message.classList.remove("error");
  if (names.some(name => name.length < 2 || name.length > 24)) {
    message.textContent = "Chaque pseudo doit contenir entre 2 et 24 caractères.";
    message.classList.add("error");
    return;
  }
  if (new Set(names.map(name => name.toLowerCase())).size !== 4) {
    message.textContent = "Chaque joueur doit avoir un pseudo différent.";
    message.classList.add("error");
    return;
  }
  submit.disabled = true;
  message.textContent = "Enregistrement de l'équipe…";
  try {
    const {data:{user},error:userError} = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Reconnecte-toi pour modifier ton équipe.");
    const {data:tournament,error:tournamentError} = await supabaseClient.from("tournaments").select("id").eq("slug","cyber-strike-cup").single();
    if (tournamentError) throw tournamentError;
    const {data:registration,error:registrationError} = await supabaseClient.from("tournament_registrations").select("id").eq("tournament_id",tournament.id).eq("player_id",user.id).single();
    if (registrationError) throw registrationError;
    const rows = names.map((player_name,index)=>({registration_id:registration.id,slot:index+1,player_name}));
    const {error:saveError} = await supabaseClient.from("tournament_team_members").upsert(rows,{onConflict:"registration_id,slot"});
    if (saveError) throw saveError;
    message.textContent = "Les 4 joueurs ont été enregistrés ! Ton équipe compte maintenant 5 membres avec toi comme capitaine.";
    await loadCyberCupRegistrations();
  } catch(error) {
    message.textContent = "Erreur : " + (error.message || "enregistrement impossible.");
    message.classList.add("error");
  } finally {
    submit.disabled = false;
  }
});


// Tableau de bord administrateur NEXUS
const adminPanel = document.getElementById("nexusAdmin");
const adminFeedback = document.getElementById("adminFeedback");
let adminTournamentId = null;
async function loadAdminDashboard() {
  if (!supabaseClient || !adminPanel) return;
  adminPanel.hidden = true;
  const {data:{user},error:userError} = await supabaseClient.auth.getUser();
  if (userError || !user) return;
  const {data:role,error:roleError} = await supabaseClient.from("nexus_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if (roleError || !role) return;
  adminPanel.hidden = false;
  const {data:tournament,error:tournamentError} = await supabaseClient.from("tournaments").select("id,name,status").eq("slug","cyber-strike-cup").single();
  if (tournamentError) { adminFeedback.textContent = "Erreur tournoi : " + tournamentError.message; return; }
  adminTournamentId = tournament.id;
  document.getElementById("adminTournamentName").textContent = tournament.name;
  document.getElementById("adminTournamentStatus").value = tournament.status;
  const {data:registrations,error:registrationError} = await supabaseClient.from("tournament_registrations").select("id,player_id,team_name,registered_at").eq("tournament_id",tournament.id).order("registered_at",{ascending:true});
  if (registrationError) { adminFeedback.textContent = "Erreur inscriptions : " + registrationError.message; return; }
  document.getElementById("adminSummary").textContent = registrations.length + " équipe(s) inscrite(s)";
  const ids = registrations.map(item=>item.player_id);
  let profiles = [];
  if (ids.length) {
    const {data,error} = await supabaseClient.from("player_profiles").select("id,username").in("id",ids);
    if (error) { adminFeedback.textContent = "Erreur profils : " + error.message; return; }
    profiles = data || [];
  }
  const registrationIds = registrations.map(item=>item.id);
  let members = [];
  if (registrationIds.length) {
    const {data,error} = await supabaseClient.from("tournament_team_members").select("registration_id,slot,player_name").in("registration_id",registrationIds).order("slot");
    if (error) { adminFeedback.textContent = "Erreur compositions : " + error.message; return; }
    members = data || [];
  }
  const list = document.getElementById("adminTeamList");
  list.replaceChildren();
  if (!registrations.length) { list.innerHTML = '<p class="ranking-empty">Aucune équipe inscrite pour le moment.</p>'; return; }
  registrations.forEach(registration=>{
    const card=document.createElement("article");card.className="admin-team-card";
    const title=document.createElement("h4");title.textContent=registration.team_name;
    const captain=document.createElement("p");captain.textContent="Capitaine : "+(profiles.find(p=>p.id===registration.player_id)?.username || "Joueur NEXUS");
    const roster=document.createElement("p");roster.textContent="Composition : "+members.filter(m=>m.registration_id===registration.id).sort((a,b)=>a.slot-b.slot).map(m=>m.player_name).join(" · ");
    const date=document.createElement("small");date.textContent="Inscrite le "+new Date(registration.registered_at).toLocaleDateString("fr-FR");
    card.append(title,captain,roster,date);list.append(card);
  });
  adminFeedback.textContent = "";
}
document.getElementById("adminSaveStatus")?.addEventListener("click",async()=>{
  if(!adminTournamentId)return;
  const button=document.getElementById("adminSaveStatus");
  button.disabled=true;adminFeedback.textContent="Mise à jour du statut…";
  try{
    const status=document.getElementById("adminTournamentStatus").value;
    const {error}=await supabaseClient.from("tournaments").update({status}).eq("id",adminTournamentId);
    if(error)throw error;
    adminFeedback.textContent="Statut du tournoi mis à jour.";
    await loadCyberCupRegistrations();
  }catch(error){adminFeedback.textContent="Erreur : "+error.message;}
  finally{button.disabled=false;}
});
