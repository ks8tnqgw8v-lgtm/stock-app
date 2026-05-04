const express = require("express");
const axios = require("axios");
const app = express();

const API_KEY = "136d4519090d413292db1aeca73a93e4";

// Stocks to track
const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"];

let previousPrices = {};

async function getStockData(symbol) {
  try {
    const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${API_KEY}`;
    const res = await axios.get(url);
    return parseFloat(res.data.price);
  } catch (e) {
    console.log("ERROR:", e.message);
    return null;
  }
}

// Simple RSI (mock realistic calculation)
function calculateRSI(change) {
  if (change < -1) return 30;
  if (change < 0) return 40;
  if (change > 1) return 70;
  return 50;
}

app.get("/", async (req, res) => {
  let output = [];

  for (let symbol of symbols) {
    const price = await getStockData(symbol);
    if (!price) continue;

    if (previousPrices[symbol]) {
      let prev = previousPrices[symbol];
      let change = ((price - prev) / prev) * 100;

      let rsi = calculateRSI(change);

      // Dip detection (loose for testing)
      if (change <= -0.1) {
        output.push({
          symbol,
          price: price.toFixed(2),
          change: change.toFixed(2) + "%",
          rsi
        });
      }
    }

    previousPrices[symbol] = price;
  }

  res.json(output);
});

app.listen(3000, () => console.log("Server running"));