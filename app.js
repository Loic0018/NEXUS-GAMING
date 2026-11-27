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
if (window.supabase && config.url && config.anonKey && !config.url.includes("TON-PROJET")) {
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
function renderProfile(user) {
  if (!user) { authForms.hidden = false; playerProfile.hidden = true; return; }
  const name = user.user_metadata?.username || user.email?.split("@")[0] || "Joueur";
  document.getElementById("profileName").textContent = name;
  document.getElementById("profileEmail").textContent = user.email || "";
  document.getElementById("profileAvatar").textContent = name.slice(0,1).toUpperCase();
  authForms.hidden = true; playerProfile.hidden = false;
  document.getElementById("authTitle").innerHTML = 'TON <span>PROFIL.</span>';
}
document.getElementById("profileButton").addEventListener("click", async () => {
  dialog.showModal();
  if (!supabaseClient) { showMessage("Configuration nécessaire : ajoute l’URL et la clé publique de ton projet Supabase dans supabase-config.js.", true); return; }
  const {data:{session}} = await supabaseClient.auth.getSession();
  renderProfile(session?.user || null);
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
      if (data.session) { renderProfile(data.user); showMessage("Compte créé avec succès !"); }
      else showMessage("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
    } else {
      const {data,error} = await supabaseClient.auth.signInWithPassword({email,password});
      if (error) throw error;
      renderProfile(data.user); showMessage("Connexion réussie !");
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
if (supabaseClient) supabaseClient.auth.onAuthStateChange((_event,session) => { if (dialog.open) renderProfile(session?.user || null); });

document.getElementById("menuToggle").addEventListener("click", () => document.querySelector(".main-nav").classList.toggle("open"));
document.querySelectorAll(".main-nav a").forEach(link => link.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open")));
document.querySelectorAll(".tournament-join").forEach(button => button.addEventListener("click", () => alert("Les inscriptions aux tournois NEXUS seront bientôt disponibles. Reste connecté !")));
