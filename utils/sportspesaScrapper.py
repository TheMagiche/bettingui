import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

SPORTPESA_PAGE = "https://www.ke.sportpesa.com/en/sports-betting/football-1/"
FETCH_GAMES_SCRIPT = """
const callback = arguments[arguments.length - 1];
const pageSize = 15;
const endpoints = [
  "https://www.ke.sportpesa.com/api/upcoming/games?type=prematch&sportId=1&section=upcoming&markets_layout=multiple&o=startTime&pag_count=15&pag_min=",
  "https://www.ke.sportpesa.com/api/todays/1/games?type=prematch&section=today&markets_layout=multiple&o=startTime&pag_count=15&pag_min="
];

(async () => {
  const events = [];
  const seen = new Set();

  try {
    for (const base of endpoints) {
      for (let page = 0; page < 8; page += 1) {
        const response = await fetch(base + (page * pageSize + 1), {
          headers: { Accept: "application/json" }
        });
        if (response.status !== 200 && response.status !== 206) {
          break;
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }
        for (const event of data) {
          const key = String(event.id || JSON.stringify(event.competitors));
          if (!seen.has(key)) {
            seen.add(key);
            events.push(event);
          }
        }
        if (data.length < pageSize) {
          break;
        }
      }
    }
    callback(events);
  } catch (error) {
    callback([]);
  }
})();
"""


def map_event(event):
    competitors = event.get("competitors") or []
    if len(competitors) < 2:
        return None

    home = next((team for team in competitors if team.get("home")), competitors[0])
    away = next((team for team in competitors if team is not home), competitors[1])
    markets = event.get("markets") or []
    market = next(
        (
            item
            for item in markets
            if "3 way" in (item.get("name") or "").lower()
            or "1x2" in (item.get("name") or "").lower()
        ),
        markets[0] if markets else None,
    )
    selections = (market or {}).get("selections") or []
    if len(selections) < 3:
        return None

    try:
        return {
            "home_team": home["name"].strip(),
            "away_team": away["name"].strip(),
            "home_win": float(selections[0]["odds"]),
            "draw": float(selections[1]["odds"]),
            "away_win": float(selections[2]["odds"]),
        }
    except (KeyError, TypeError, ValueError):
        return None


def scrape_sportpesa_dynamic():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=chrome_options
    )

    try:
        driver.get(SPORTPESA_PAGE)
        time.sleep(8)
        events = driver.execute_async_script(FETCH_GAMES_SCRIPT)
        games = [game for game in (map_event(event) for event in events or []) if game]
        print(json.dumps(games, indent=2))
        return games
    finally:
        driver.quit()


if __name__ == "__main__":
    scrape_sportpesa_dynamic()
