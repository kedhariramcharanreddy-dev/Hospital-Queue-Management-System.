
const db = require("./db");

async function testConnection() {
    try {
        const connection = await db.getConnection();

        console.log("MySQL Connected Successfully!");

        const [rows] = await connection.query(
            "SHOW TABLES"
        );

        console.log("Database Tables:", rows);

        connection.release();
        await db.end();

    } catch (error) {
        console.error("Database Connection Failed:", error.message);
    }
}

testConnection();
