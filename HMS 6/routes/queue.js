const express = require("express");
const db = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// Patient: return the logged-in patient's latest active queue entry.
router.get("/current", async (req, res) => {
    try {
        if (req.user.role !== "patient") {
            return res.status(403).json({ message: "Patient access only." });
        }

        const [rows] = await db.execute(
            `SELECT q.queueId AS id, q.tokenNumber AS tokenNumber,
                    q.status AS status, q.createdAt AS date,
                    d.name AS doctor_name, d.department AS department, p.name AS patient_name
             FROM Queue q
             JOIN Users p ON p.userId = q.patientId
             LEFT JOIN Users d ON d.userId = q.doctorId
             WHERE q.patientId = ?
             ORDER BY q.createdAt DESC, q.queueId DESC
             LIMIT 1`,
            [req.user.id]
        );

        if (!rows.length) {
            const [notifications] = await db.execute(
                `SELECT message, createdAt AS created_at
                 FROM Notifications WHERE userId = ?
                 ORDER BY createdAt DESC LIMIT 10`,
                [req.user.id]
            );
            const [patientRows] = await db.execute("SELECT name FROM Users WHERE userId = ?", [req.user.id]);
            return res.json({ patient: { name: patientRows[0]?.name || "Patient" }, queue: {}, notifications });
        }

        const queue = rows[0];
        let position = 0;
        if (["Waiting", "In Consultation"].includes(queue.status)) {
            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS ahead FROM Queue
                 WHERE doctorId = (
                    SELECT doctorId FROM Queue WHERE queueId = ?
                 ) AND status = 'Waiting' AND
                 (createdAt < (SELECT createdAt FROM Queue WHERE queueId = ?)
                  OR (createdAt = (SELECT createdAt FROM Queue WHERE queueId = ?) AND queueId < ?))`,
                [queue.id, queue.id, queue.id, queue.id]
            );
            position = Number(countRows[0].ahead) + (queue.status === "In Consultation" ? 0 : 1);
        }

        const [notifications] = await db.execute(
            `SELECT message, createdAt AS created_at
             FROM Notifications WHERE userId = ?
             ORDER BY createdAt DESC LIMIT 10`,
            [req.user.id]
        );

        res.json({
            patient: { name: queue.patient_name },
            queue: {
                ...queue,
                position,
                estimatedWait: queue.status === "Waiting" ? Math.max(0, position - 1) * 10 : 0
            },
            notifications
        });
    } catch (error) {
        console.error("GET /api/queue/current:", error);
        res.status(500).json({ message: "Could not load your queue." });
    }
});


// Doctor: list registered patients for the token-generation form.
router.get("/patients", async (req, res) => {
    try {
        if (req.user.role !== "doctor") {
            return res.status(403).json({ message: "Doctor access only." });
        }
        const [rows] = await db.execute(
            `SELECT userId AS id, name, email, contact
             FROM Users WHERE role = 'patient' ORDER BY name ASC`
        );
        res.json({ patients: rows });
    } catch (error) {
        console.error("GET /api/queue/patients:", error);
        res.status(500).json({ message: "Could not load registered patients." });
    }
});

// Doctor: generate the next daily token for a registered patient.
router.post("/generate", async (req, res) => {
    if (req.user.role !== "doctor") {
        return res.status(403).json({ message: "Only doctors can generate queue tokens." });
    }

    const patientId = Number(req.body.patientId);
    if (!Number.isInteger(patientId) || patientId < 1) {
        return res.status(400).json({ message: "Please select a valid patient." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock this doctor's row so simultaneous requests receive different token numbers.
        const [doctorRows] = await connection.execute(
            "SELECT userId, name, department FROM Users WHERE userId = ? AND role = 'doctor' FOR UPDATE",
            [req.user.id]
        );
        if (!doctorRows.length) {
            await connection.rollback();
            return res.status(403).json({ message: "Doctor account not found." });
        }

        const [patientRows] = await connection.execute(
            "SELECT userId, name FROM Users WHERE userId = ? AND role = 'patient'",
            [patientId]
        );
        if (!patientRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Selected patient was not found." });
        }

        const [existing] = await connection.execute(
            `SELECT queueId, tokenNumber FROM Queue
             WHERE patientId = ? AND doctorId = ? AND DATE(createdAt) = CURDATE()
               AND status IN ('Waiting', 'In Consultation')
             ORDER BY queueId DESC LIMIT 1`,
            [patientId, req.user.id]
        );
        if (existing.length) {
            await connection.rollback();
            return res.status(409).json({
                message: `This patient already has an active token today: ${existing[0].tokenNumber}.`,
                tokenNumber: existing[0].tokenNumber
            });
        }

        const [maxRows] = await connection.execute(
            `SELECT COALESCE(MAX(tokenNumber), 0) AS lastToken
             FROM Queue WHERE doctorId = ? AND DATE(createdAt) = CURDATE()`,
            [req.user.id]
        );
        const tokenNumber = Number(maxRows[0].lastToken) + 1;

        const [result] = await connection.execute(
            `INSERT INTO Queue
             (tokenNumber, patientId, doctorId, status, createdAt, updatedAt)
             VALUES (?, ?, ?, 'Waiting', NOW(), NOW())`,
            [tokenNumber, patientId, req.user.id]
        );

        const doctor = doctorRows[0];
        await connection.execute(
            `INSERT INTO Notifications (userId, message, status)
             VALUES (?, ?, 'Sent')`,
            [patientId, `Your queue token is ${tokenNumber}. Doctor: ${doctor.name}. Department: ${doctor.department || "General"}. Status: Waiting.`]
        );

        await connection.commit();
        res.status(201).json({
            message: "Queue token generated successfully.",
            queue: {
                id: result.insertId,
                tokenNumber,
                patientId,
                patientName: patientRows[0].name,
                doctorName: doctor.name,
                department: doctor.department || "General",
                status: "Waiting"
            }
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("POST /api/queue/generate:", error);
        res.status(500).json({ message: "Could not generate the queue token." });
    } finally {
        if (connection) connection.release();
    }
});

// Doctor: list queue records assigned to the logged-in doctor.
router.get("/doctor/:doctorId", async (req, res) => {
    try {
        if (req.user.role !== "doctor" || Number(req.params.doctorId) !== Number(req.user.id)) {
            return res.status(403).json({ message: "You can only view your own queue." });
        }
        const [rows] = await db.execute(
            `SELECT q.queueId AS id, q.tokenNumber AS token_number,
                    q.status, p.name AS patient_name,
                    COALESCE(d.department, 'General') AS department,
                    q.createdAt AS created_at
             FROM Queue q
             JOIN Users p ON p.userId = q.patientId
             JOIN Users d ON d.userId = q.doctorId
             WHERE q.doctorId = ? AND DATE(q.createdAt) = CURDATE()
             ORDER BY CASE q.status
                WHEN 'In Consultation' THEN 0 WHEN 'Waiting' THEN 1
                WHEN 'Skipped' THEN 2 ELSE 3 END, q.createdAt ASC`,
            [req.user.id]
        );
        res.json({ queue: rows });
    } catch (error) {
        console.error("GET /api/queue/doctor:", error);
        res.status(500).json({ message: "Could not load the doctor queue." });
    }
});

async function updateQueueStatus(req, res, status) {
    const queueId = Number(req.params.id);
    if (!Number.isInteger(queueId) || queueId < 1) {
        return res.status(400).json({ message: "Invalid queue record." });
    }
    if (req.user.role !== "doctor") {
        return res.status(403).json({ message: "Doctor access only." });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
            "SELECT queueId, patientId FROM Queue WHERE queueId = ? AND doctorId = ? FOR UPDATE",
            [queueId, req.user.id]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Queue record not found." });
        }
        await connection.execute(
            "UPDATE Queue SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE queueId = ?",
            [status, queueId]
        );
        const messages = {
            "In Consultation": "Your consultation is starting now.",
            "Completed": "Your consultation has been completed.",
            "Skipped": "Your queue turn was skipped. Please contact the reception. ",
            "Waiting": "You have been recalled to the waiting queue."
        };
        await connection.execute(
            "INSERT INTO Notifications (userId, message, status) VALUES (?, ?, 'Sent')",
            [rows[0].patientId, messages[status]]
        );
        await connection.commit();
        res.json({ message: "Queue status updated successfully.", queueId, status });
    } catch (error) {
        await connection.rollback();
        console.error("Update queue status:", error);
        res.status(500).json({ message: "Could not update queue status." });
    } finally {
        connection.release();
    }
}

router.put("/status/:id", (req, res) => {
    const allowed = ["In Consultation"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
    return updateQueueStatus(req, res, req.body.status);
});
router.put("/end/:id", (req, res) => updateQueueStatus(req, res, "Completed"));
router.put("/skip/:id", (req, res) => updateQueueStatus(req, res, "Skipped"));
router.put("/recall/:id", (req, res) => updateQueueStatus(req, res, "Waiting"));

module.exports = router;
