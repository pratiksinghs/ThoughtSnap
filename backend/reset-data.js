
const mongoose = require("mongoose");
require("dotenv").config();

const EXPECTED_DATABASE = "test";

const User = require("./models/User");
const Post = require("./models/Post");
const Notification = require("./models/Notification");

async function resetData() {
  let connected = false;

  try {
    if (!process.argv.includes("--confirm")) {
      console.log("SAFE MODE: Nothing was deleted.");
      console.log("Review the database before confirming.");
      console.log("To proceed, run: node reset-data.js --confirm");
      return;
    }

    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI || mongoURI.includes("your_mongodb_atlas")) {
      throw new Error("MONGODB_URI is missing or not configured.");
    }

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000
    });

    connected = true;

    const db = mongoose.connection.db;
    const actualDatabase = db.databaseName;

    console.log("\nConnected database:", actualDatabase);

    if (actualDatabase !== EXPECTED_DATABASE) {
      throw new Error(
        `Wrong database. Expected "${EXPECTED_DATABASE}". No records deleted.`
      );
    }

    const existingCollections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    const existingNames = existingCollections.map(
      (collection) => collection.name
    );

    const required = [
      { name: "users", model: User },
      { name: "posts", model: Post },
      { name: "notifications", model: Notification }
    ];

    for (const item of required) {
      if (!existingNames.includes(item.name)) {
        throw new Error(
          `Required collection "${item.name}" is missing. No records deleted.`
        );
      }
    }

    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const notificationCount = await Notification.countDocuments();

    console.log("\nRecords before deletion:");
    console.log("Users:", userCount);
    console.log("Posts:", postCount);
    console.log("Notifications:", notificationCount);
    console.log("\nThe memories collection will NOT be changed.");

    const confirmation = process.argv.includes(
      "--confirm-test-database"
    );

    if (!confirmation) {
      console.log("\nSecond confirmation is required.");
      console.log(
        "Run: node reset-data.js --confirm --confirm-test-database"
      );
      console.log("Nothing was deleted.");
      return;
    }

    const postResult = await Post.deleteMany({});
    const notificationResult = await Notification.deleteMany({});
    const userResult = await User.deleteMany({});

    console.log("\nDeletion completed:");
    console.log("Posts deleted:", postResult.deletedCount);
    console.log("Notifications deleted:", notificationResult.deletedCount);
    console.log("Users deleted:", userResult.deletedCount);

    console.log("\nRemaining record counts:");
    console.log("Users:", await User.countDocuments());
    console.log("Posts:", await Post.countDocuments());
    console.log("Notifications:", await Notification.countDocuments());

    console.log("\nCollections still present:");
    console.log(
      (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((collection) => collection.name)
    );

    console.log("\nReset completed. Database structure was not dropped.");
  } catch (error) {
    console.error("\nReset stopped:", error.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

resetData();
