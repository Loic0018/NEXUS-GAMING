const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".game-card");
const search = document.getElementById("gameSearch");
const emptyState = document.getElementById("emptyState");
let activeFilter = "all";

function updateGames() {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const matchesCategory = activeFilter === "all" || card.dataset.category === activeFilter;
    const matchesSearch = card.dataset.name.includes(term);
    const show = matchesCategory && matchesSearch;
    card.hidden = !show;
    if (show) visible++;
  });
  emptyState.hidden = visible !== 0;
}

filters.forEach(button => {
  button.addEventListener("click", () => {
    filters.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    updateGames();
  });
});
search.addEventListener("input", updateGames);

const dialog = document.getElementById("profileDialog");
document.getElementById("profileButton").addEventListener("click", () => dialog.showModal());
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("gotIt").addEventListener("click", () => dialog.close());

document.getElementById("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("open");
});
document.querySelectorAll(".main-nav a").forEach(link => {
  link.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open"));
});

document.querySelectorAll(".tournament-join").forEach(button => {
  button.addEventListener("click", () => {
    alert("Les inscriptions aux tournois NEXUS seront bientôt disponibles. Reste connecté !");
  });
});
