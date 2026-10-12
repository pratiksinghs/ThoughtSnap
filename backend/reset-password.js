
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  let password;

  try {
    password = await new Promise((resolve) => {
      rl.question("Enter a NEW password (8-72 characters): ", resolve);
    });

    if (password.length < 8 || password.length > 72) {
      throw new Error("Password must be 8-72 characters.");
    }

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from backend/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await mongoose.connection
      .collection("users")
      .updateOne(
        { email: "singhpratik0143@gmail.com" },
        { $set: { password: hashedPassword } }
      );

    if (result.matchedCount === 1) {
      console.log("\nPassword updated successfully.");
    } else {
      console.log("\nAccount not found. Nothing was changed.");
    }
  } catch (error) {
    console.error("\nReset failed:", error.message);
  } finally {
    password = "";
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

main();
