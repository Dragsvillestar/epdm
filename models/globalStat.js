const mongoose = require("mongoose");

const statsSchema = new mongoose.Schema({
  totalViews: { type: Number, default: 0 },
});

const GlobalStats = mongoose.model("GlobalStats", statsSchema);

module.exports = GlobalStats;
