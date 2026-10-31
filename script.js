
const buttons = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".article-card");
const search = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");

let selectedTopic = "all";

function updateArticles() {
  const query = search.value.toLowerCase().trim();
  let visible = 0;

  cards.forEach(card => {
    const matchesTopic =
      selectedTopic === "all" ||
      card.dataset.topic.split(/\s+/).includes(selectedTopic);

    const matchesSearch = card.textContent
      .toLowerCase()
      .includes(query);

    const show = matchesTopic && matchesSearch;
    card.hidden = !show;

    if (show) visible++;
  });

  emptyState.hidden = visible > 0;
}

buttons.forEach(button => {
  button.addEventListener("click", () => {
    selectedTopic = button.dataset.topic;

    buttons.forEach(item =>
      item.classList.toggle("active", item === button)
    );

    updateArticles();
  });
});

search.addEventListener("input", updateArticles);
