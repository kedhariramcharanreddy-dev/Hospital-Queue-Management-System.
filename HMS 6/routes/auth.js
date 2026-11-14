
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

// Patient registration
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, contact } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const [existing] = await db.execute(
            "SELECT userId FROM Users WHERE email = ?",
            [email]
        );

        if (existing.length) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const [result] = await db.execute(
            `INSERT INTO Users
             (name, email, password, role, contact)
             VALUES (?, ?, ?, 'patient', ?)`,
            [name, email, hashedPassword, contact || null]
        );

        res.status(201).json({
            message: "Patient registered successfully",
            user: {
                id: result.insertId,
                name,
                email,
                role: "patient"
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Registration failed" });
    }
});


// Doctor registration
router.post("/register-doctor", async (req, res) => {
    try {
        const { name, email, password, contact, department } = req.body;

        if (!name || !email || !password || !department) {
            return res.status(400).json({
                message: "Name, email, password and department are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const [existing] = await db.execute(
            "SELECT userId FROM Users WHERE email = ?",
            [email]
        );

        if (existing.length) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const [result] = await db.execute(
            `INSERT INTO Users (name, email, password, role, contact, department)
             VALUES (?, ?, ?, 'doctor', ?, ?)`,
            [name, email, hashedPassword, contact || null, department]
        );

        res.status(201).json({
            message: "Doctor registered successfully",
            user: { id: result.insertId, name, email, role: "doctor", department }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Doctor registration failed" });
    }
});

// Patient and doctor login
router.post("/login", async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Email, password and role are required"
            });
        }

        if (!["patient", "doctor"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        const [users] = await db.execute(
            "SELECT * FROM Users WHERE email = ? AND role = ?",
            [email, role]
        );

        if (!users.length) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            { id: user.userId, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.userId,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Login failed" });
    }
});

module.exports = router;
