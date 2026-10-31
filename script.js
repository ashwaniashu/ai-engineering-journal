
const buttons = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".article-card");
const featuredStory = document.querySelector(".featured-story");
const search = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");

let selectedTopic = "all";

function updateArticles() {
  const query = search.value.toLowerCase().trim();
  let visible = 0;

  cards.forEach(card => {
    const matchesTopic =
      selectedTopic === "all" ||
      card.dataset.topic.split("|").includes(selectedTopic);

    const matchesSearch = card.textContent
      .toLowerCase()
      .includes(query);

    const show = matchesTopic && matchesSearch;
    card.hidden = !show;

    if (show) visible++;
  });

  if (featuredStory) {
    const matchesTopic =
      selectedTopic === "all" ||
      featuredStory.dataset.topic.split("|").includes(selectedTopic);
    const matchesSearch = featuredStory.textContent
      .toLowerCase()
      .includes(query);
    const show = matchesTopic && matchesSearch;

    featuredStory.hidden = !show;
    if (show) visible++;
  }

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

const particleCanvas = document.querySelector("#hero-particles");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = navigator.connection?.saveData === true;

if (particleCanvas && !reducedMotion && !saveData && window.tsParticles?.load && window.loadSlim) {
  const isSmallViewport = window.matchMedia("(max-width: 600px)").matches;

  window.loadSlim(window.tsParticles).then(() => window.tsParticles.load({
    id: "hero-particles",
    options: {
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      detectRetina: false,
      fpsLimit: isSmallViewport ? 24 : 30,
      pauseOnBlur: true,
      particles: {
        number: {
          value: isSmallViewport ? 12 : 22,
          density: { enable: true, width: 900, height: 600 }
        },
        color: { value: "#6675d9" },
        links: {
          enable: true,
          distance: isSmallViewport ? 105 : 145,
          color: "#8791c8",
          opacity: 0.16,
          width: 1
        },
        opacity: { value: 0.3 },
        shape: { type: "circle" },
        size: { value: { min: 1, max: 2.2 } },
        move: {
          enable: true,
          speed: 0.28,
          direction: "none",
          random: true,
          straight: false,
          outModes: { default: "out" }
        }
      },
      interactivity: {
        events: {
          onHover: { enable: false },
          onClick: { enable: false }
        }
      },
      responsive: [{
        maxWidth: 600,
        options: {
          particles: {
            number: { value: 12 },
            links: { distance: 105 }
          }
        }
      }]
    }
  })).catch(error => {
    console.warn("The decorative background could not be initialized.", error);
  });
}
