const fs = require("fs");

const WIDTH = 900;
const HEIGHT = 500;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

const USERNAME = process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) {
  console.error("GH_TOKEN is missing.");
  process.exit(1);
}

async function fetchContributions() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const json = await response.json();

  if (json.errors) {
    console.error("GraphQL Error:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function generateSVG(weeks) {
  const weeklyTotals = weeks.map(week =>
    week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0)
  );

  const totalCommits = weeklyTotals.reduce((a, b) => a + b, 0);
  const maxWeek = Math.max(...weeklyTotals) || 1;

  let svg = `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">

<style>
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
text {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  fill: #a0a0a0;
}
.title { fill: #ffffff; font-weight: bold; }
.highlight { fill: #FF7139; font-weight: bold; }
</style>

<rect width="100%" height="100%" fill="#121212" rx="15"/>

<g style="transform-origin:${CENTER_X}px ${CENTER_Y}px;">
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${Math.min(45 + (totalCommits/100), 55)}"
          fill="#FFB000"
          opacity="0.9">
    <animate attributeName="r"
             values="${Math.min(42 + (totalCommits/100), 52)};${Math.min(50 + (totalCommits/100), 60)};${Math.min(42 + (totalCommits/100), 52)}"
             dur="4s"
             repeatCount="indefinite"/>
  </circle>
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${Math.min(60 + (totalCommits/100), 80)}" fill="#FF7139" opacity="0.15" />
</g>
`;

  weeklyTotals.forEach((count, index) => {
    const orbit = 85 + index * 3.5; // Tighter orbits to fit all weeks
    const size = count === 0 ? 1.5 : 2 + (count / maxWeek) * 8; // Zero commit weeks are tiny, active weeks are large
    const speed = 50 + index * 1.5; // Outer planets move slightly slower visually
    
    // Color mapping: 0 commits = dim gray. Active = bright yellow/orange
    const fill = count === 0 ? "#333333" : `hsl(${45 - (count / maxWeek) * 35}, 100%, 60%)`; 
    
    // Fixes the "straight line" issue by giving each planet a random starting point on its orbit ring
    const startAngle = Math.random() * 360; 

    // Add faint orbit path lines every 4 weeks to give it structure
    if (index % 4 === 0) {
        svg += `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${orbit}" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="0.5"/>`;
    }

    svg += `
  <g style="transform-origin:${CENTER_X}px ${CENTER_Y}px;
            transform: rotate(${startAngle}deg);
            animation: rotate ${speed}s linear infinite;">
    <circle cx="${CENTER_X + orbit}"
            cy="${CENTER_Y}"
            r="${size}"
            fill="${fill}"
            opacity="0.9">
      <title>Week ${index + 1}: ${count} commits</title> 
    </circle>
  </g>
`;
  });

  svg += `
  <g transform="translate(30, 40)">
    <text class="title" x="0" y="0" font-size="22">Contribution Universe</text>
    <text x="0" y="25" font-size="14">Total Year Commits: <tspan class="highlight">${totalCommits}</tspan></text>
  </g>

  <g transform="translate(30, ${HEIGHT - 80})">
    <text class="title" x="0" y="0" font-size="14">Data Legend</text>
    <text x="0" y="22" font-size="12">☀️ Core Size = Total Annual Impact</text>
    <text x="0" y="42" font-size="12">🪐 Planet Size/Color = Weekly Intensity</text>
    <text x="0" y="62" font-size="12">🌌 Orbit Distance = Time (Outer = Most Recent Week)</text>
  </g>

</svg>
`;

  fs.writeFileSync("assets/universe.svg", svg);
  console.log("Universe SVG generated successfully.");
}

(async () => {
  try {
    const weeks = await fetchContributions();
    generateSVG(weeks);
  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
})();
