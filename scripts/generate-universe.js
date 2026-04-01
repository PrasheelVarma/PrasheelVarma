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
  <!-- Generated at ${new Date().toISOString()} -->
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">

<style>
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
text {
  font-family: Arial, sans-serif;
  fill: white;
}
</style>

<rect width="100%" height="100%" fill="#0b0f1a"/>

<!-- Core -->
<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="45"
        fill="cyan"
        opacity="0.85">
  <animate attributeName="r"
           values="42;52;42"
           dur="4s"
           repeatCount="indefinite"/>
</circle>
`;

  weeklyTotals.forEach((count, index) => {
    const orbit = 80 + index * 4;
    const size = 3 + (count / maxWeek) * 10;
    const speed = 40 + index * 1.2;
    const hue = 180 + (count / maxWeek) * 120;

    svg += `
  <g style="transform-origin:${CENTER_X}px ${CENTER_Y}px;
            animation: rotate ${speed}s linear infinite;">
    <circle cx="${CENTER_X + orbit}"
            cy="${CENTER_Y}"
            r="${size}"
            fill="hsl(${hue}, 80%, 60%)"
            opacity="0.8"/>
  </g>
`;
  });

  svg += `
  <!-- Stats -->
  <text x="${CENTER_X}" y="190" font-size="20" text-anchor="middle">
    Contribution Universe
  </text>

  <text x="300" y="230" font-size="14">
    Total Commits (Past Year): ${totalCommits}
  </text>

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
