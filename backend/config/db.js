
const mongoose = require("mongoose");

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || mongoURI.includes("your_mongodb_atlas")) {
    throw new Error("Please configure MONGODB_URI in backend/.env");
  }

  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000
  });

  console.log("MongoDB Atlas connected successfully");
}

module.exports = connectDB;
