require("dotenv").config();
const authRoutes = require("./routes/auth");
const queueRoutes = require("./routes/queue");
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/queue", queueRoutes);
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`HMS running at http://localhost:${PORT}`);
});
