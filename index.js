const express = require("express");
const axios = require("axios");
const cron = require("node-cron");

const app = express();

const symbols = [
  "^NSEI", "^BSESN", "^DJI", "^IXIC",
  "RELIANCE.NS", "INFY.NS",
  "AAPL", "TSLA", "NVDA",
  "GC=F", "SI=F", "HG=F",
  "USDINR=X"
];

let previousPrices = {};
let rsiCache = {};
let usdToInr = 83;

async function fetchData() {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`;
  const res = await axios.get(url);
  return res.data.quoteResponse.result;
}

async function getCloses(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;
  const res = await axios.get(url);
  return res.data.chart.result[0].indicators.quote[0].close.filter(v => v);
}

function calcRSI(closes, period = 14) {
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];

    if (diff >= 0) {
      avgGain = (avgGain * 13 + diff) / 14;
      avgLoss = (avgLoss * 13) / 14;
    } else {
      avgGain = (avgGain * 13) / 14;
      avgLoss = (avgLoss * 13 - diff) / 14;
    }
  }

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function score(change, volume, rsi) {
  let s = 0;

  if (change <= -1) s += 2;
  if (change <= -2) s += 3;
  if (volume > 1.5) s += 2;
  if (rsi < 30) s += 3;
  else if (rsi < 40) s += 2;

  return Math.min(s, 10);
}

let latestOutput = [];

async function runEngine() {
  try {
    const data = await fetchData();
    let output = [];

    const fx = data.find(d => d.symbol === "USDINR=X");
    if (fx) usdToInr = fx.regularMarketPrice;

    for (let item of data) {
      const symbol = item.symbol;
      const price = item.regularMarketPrice;

      if (!price) continue;

      if (!rsiCache[symbol]) {
        try {
          const closes = await getCloses(symbol);
          rsiCache[symbol] = calcRSI(closes);
        } catch {}
      }

      const rsi = rsiCache[symbol] || 50;

      if (previousPrices[symbol]) {
        const change =
          ((price - previousPrices[symbol]) /
            previousPrices[symbol]) * 100;

        const volume =
          item.regularMarketVolume /
          item.averageDailyVolume10Day || 1;

        const s = score(change, volume, rsi);

        const priceINR = symbol.includes(".NS")
          ? price
          : symbol.includes("=") || symbol.includes("^")
          ? price
          : price * usdToInr;

        if (change <= -1 && s >= 6) {
          output.push({
            symbol,
            change: change.toFixed(2),
            rsi: rsi.toFixed(1),
            score: s,
            priceINR: Math.round(priceINR)
          });
        }
      }

      previousPrices[symbol] = price;
    }

    const india = output.filter(x => x.symbol.includes(".NS"));
    const global = output.filter(x => !x.symbol.includes(".NS"));

    let insight = "No strong signals";

    if (global.length > india.length)
      insight = "🌍 Global markets stronger dips";
    else if (india.length > global.length)
      insight = "🇮🇳 Indian market opportunities";

    latestOutput = {
      insight,
      opportunities: output
    };

    console.log("Updated");
  } catch (e) {
    console.log("Error:", e.message);
  }
}

cron.schedule("*/2 * * * *", runEngine);

app.get("/", (req, res) => {
  res.json(latestOutput);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
  runEngine();
});