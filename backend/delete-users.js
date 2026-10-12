const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");

async function deleteAllUsers() {
  try {
    const answer = process.argv.includes("--confirm");

    if (!answer) {
      console.log("Nothing deleted.");
      console.log("To confirm, run: node delete-users.js --confirm");
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const result = await User.deleteMany({});

    console.log(`Deleted ${result.deletedCount} user accounts.`);
  } catch (error) {
    console.error("Deletion failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

deleteAllUsers();