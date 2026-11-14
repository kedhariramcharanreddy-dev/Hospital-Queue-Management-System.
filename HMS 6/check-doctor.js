
const db = require("./db");
const bcrypt = require("bcryptjs");

async function checkDoctor() {
    try {
        const [rows] = await db.execute(
            "SELECT password FROM Users WHERE email = ?",
            ["doctor@test.com"]
        );

        if (!rows.length) {
            console.log("Doctor account not found");
            return;
        }

        const valid = await bcrypt.compare(
            "Doctor123",
            rows[0].password
        );

        console.log("Password verification:", valid);
        
        if (valid) {
            console.log("Doctor password is correct!");
        } else {
            console.log("Stored password does not match Doctor123");
        }

    } catch (error) {
        console.log(error.message);
    } finally {
        await db.end();
    }
}

checkDoctor();
