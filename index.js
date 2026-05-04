const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({
    status: "NEW CODE WORKING",
    time: new Date()
  });
});

app.listen(3000, () => console.log("Server running"));