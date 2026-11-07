require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "Ali@2006!Aze3Z",
    database: process.env.DB_NAME || "school_fee_management",
    waitForConnections: true,
    connectionLimit: 10
});

// Test database connection
app.get("/api/test", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ message: "Database connected successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard
app.get("/api/dashboard", async (req, res) => {
    try {
        const [[students]] = await db.query(
            "SELECT COUNT(*) AS totalStudents FROM students"
        );

        const [[fees]] = await db.query(
            `SELECT COALESCE(SUM(totalamount), 0) AS totalFees
             FROM feedetails`
        );

        const [[paid]] = await db.query(
            `SELECT COALESCE(SUM(amountpaid), 0) AS collectedFees
             FROM payments`
        );

        const totalStudents = Number(students?.totalStudents || 0);
        const totalFees = Number(fees?.totalFees || 0);
        const collectedFees = Number(paid?.collectedFees || 0);
        const pendingFees = Math.max(0, totalFees - collectedFees);

        res.json({
            totalStudents,
            totalFees,
            collectedFees,
            pendingFees
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get students
app.get("/api/students", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM students ORDER BY studentid DESC"
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add student
app.post("/api/students", async (req, res) => {
    try {
        const { name, class: studentClass, rollno, phone, email } = req.body;

        if (!name || !studentClass || !rollno || !phone) {
            return res.status(400).json({ error: "Name, class, roll number, and phone number are required." });
        }

        const [result] = await db.query(
            `INSERT INTO students (name, class, rollno, phone, email)
             VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), studentClass.trim(), rollno.trim(), phone.trim(), email ? email.trim() : null]
        );

        res.status(201).json({
            message: "Student added successfully",
            studentid: result.insertId
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update student
app.put("/api/students/:id", async (req, res) => {
    try {
        const { name, class: studentClass, rollno, phone, email } = req.body;

        if (!name || !studentClass || !rollno || !phone) {
            return res.status(400).json({ error: "Name, class, roll number, and phone number are required." });
        }

        const [result] = await db.query(
            `UPDATE students SET name=?, class=?, rollno=?, phone=?, email=?
             WHERE studentid=?`,
            [name.trim(), studentClass.trim(), rollno.trim(), phone.trim(), email ? email.trim() : null, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Student not found" });
        }

        res.json({ message: "Student updated successfully" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete student
app.delete("/api/students/:id", async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if student exists
        const [studentRows] = await connection.query(
            "SELECT studentid FROM students WHERE studentid = ?",
            [req.params.id]
        );

        if (!studentRows.length) {
            await connection.rollback();
            return res.status(404).json({ error: "Student not found" });
        }

        // Delete associated payments first
        await connection.query(
            `DELETE p FROM payments p
             JOIN feedetails f ON p.feeid = f.feeid
             WHERE f.studentid = ?`,
            [req.params.id]
        );

        // Delete associated fee records
        await connection.query(
            "DELETE FROM feedetails WHERE studentid = ?",
            [req.params.id]
        );

        // Delete student
        await connection.query(
            "DELETE FROM students WHERE studentid = ?",
            [req.params.id]
        );

        await connection.commit();
        res.json({ message: "Student and associated records deleted successfully" });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Get fee details
app.get("/api/fees", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT f.*,
                   s.name,
                   s.name AS studentname,
                   s.rollno,
                   s.class,
                   COALESCE(SUM(p.amountpaid), 0) AS paidamount,
                   COALESCE(SUM(p.amountpaid), 0) AS amountpaid,
                   f.totalamount - COALESCE(SUM(p.amountpaid), 0) AS pendingamount
            FROM feedetails f
            JOIN students s ON f.studentid = s.studentid
            LEFT JOIN payments p ON f.feeid = p.feeid
            GROUP BY f.feeid
            ORDER BY f.feeid DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign fee
app.post("/api/fees", async (req, res) => {
    try {
        const { studentid, academicyear, feetype, totalamount, duedate } = req.body;

        if (!studentid || !academicyear || !feetype || isNaN(Number(totalamount)) || Number(totalamount) <= 0 || !duedate) {
            return res.status(400).json({ error: "Please enter valid fee details. Amount must be greater than 0." });
        }

        const [studentRows] = await db.query(
            "SELECT studentid FROM students WHERE studentid = ?",
            [studentid]
        );

        if (!studentRows.length) {
            return res.status(404).json({ error: "Selected student does not exist." });
        }

        const [result] = await db.query(
            `INSERT INTO feedetails
             (studentid, academicyear, feetype, totalamount, duedate)
             VALUES (?, ?, ?, ?, ?)`,
            [studentid, academicyear.trim(), feetype.trim(), Number(totalamount), duedate]
        );

        res.status(201).json({
            message: "Fee assigned successfully",
            feeid: result.insertId
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get payments
app.get("/api/payments", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*,
                   s.name,
                   s.name AS studentname,
                   s.rollno,
                   s.class,
                   f.feetype,
                   f.totalamount
            FROM payments p
            JOIN feedetails f ON p.feeid = f.feeid
            JOIN students s ON f.studentid = s.studentid
            ORDER BY p.paymentid DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record payment
app.post("/api/payments", async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { feeid, amountpaid, paymentdate, paymentmethod, receiptno } = req.body;

        if (!feeid || !amountpaid || !paymentdate || !paymentmethod || !receiptno) {
            return res.status(400).json({ error: "All payment fields are required." });
        }

        const parsedAmount = Number(amountpaid);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: "Payment amount must be greater than 0." });
        }

        await connection.beginTransaction();

        const [feeRows] = await connection.query(
            `SELECT f.totalamount,
                    COALESCE(SUM(p.amountpaid), 0) AS paid
             FROM feedetails f
             LEFT JOIN payments p ON f.feeid = p.feeid
             WHERE f.feeid = ?
             GROUP BY f.feeid FOR UPDATE`,
            [feeid]
        );

        if (!feeRows.length) {
            throw new Error("Fee record not found.");
        }

        const pending = Number(feeRows[0].totalamount) - Number(feeRows[0].paid);

        if (parsedAmount > pending + 0.001) {
            throw new Error(`Invalid payment amount. Maximum pending fee is ₹${pending.toFixed(2)}.`);
        }

        // Check for duplicate receipt number
        const [existingReceipt] = await connection.query(
            "SELECT paymentid FROM payments WHERE receiptno = ?",
            [receiptno.trim()]
        );

        if (existingReceipt.length) {
            throw new Error(`Receipt number '${receiptno.trim()}' already exists. Please enter a unique receipt number.`);
        }

        await connection.query(
            `INSERT INTO payments
             (feeid, amountpaid, paymentdate, paymentmethod, receiptno)
             VALUES (?, ?, ?, ?, ?)`,
            [feeid, parsedAmount, paymentdate, paymentmethod.trim(), receiptno.trim()]
        );

        await connection.commit();
        res.status(201).json({ message: "Payment recorded successfully" });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Pending fees
app.get("/api/pending", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT f.feeid,
                   f.academicyear,
                   f.feetype,
                   f.totalamount,
                   f.duedate,
                   s.studentid,
                   s.name,
                   s.name AS studentname,
                   s.rollno,
                   s.class,
                   COALESCE(SUM(p.amountpaid), 0) AS paidamount,
                   COALESCE(SUM(p.amountpaid), 0) AS amountpaid,
                   f.totalamount - COALESCE(SUM(p.amountpaid), 0) AS pendingamount
            FROM feedetails f
            JOIN students s ON f.studentid = s.studentid
            LEFT JOIN payments p ON f.feeid = p.feeid
            GROUP BY f.feeid
            HAVING pendingamount > 0
            ORDER BY f.duedate ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Student fee report
app.get("/api/reports/:studentid", async (req, res) => {
    try {
        const [[student]] = await db.query(
            "SELECT studentid, name, class, rollno, phone, email FROM students WHERE studentid = ?",
            [req.params.studentid]
        );

        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const [fees] = await db.query(`
            SELECT f.feeid,
                   f.academicyear,
                   f.feetype,
                   f.totalamount,
                   f.duedate,
                   COALESCE(SUM(p.amountpaid), 0) AS amountpaid,
                   COALESCE(SUM(p.amountpaid), 0) AS paidamount,
                   f.totalamount - COALESCE(SUM(p.amountpaid), 0) AS pendingamount
            FROM feedetails f
            LEFT JOIN payments p ON f.feeid = p.feeid
            WHERE f.studentid = ?
            GROUP BY f.feeid
            ORDER BY f.feeid DESC
        `, [req.params.studentid]);

        const totalAssigned = fees.reduce((sum, f) => sum + Number(f.totalamount || 0), 0);
        const totalPaid = fees.reduce((sum, f) => sum + Number(f.amountpaid || 0), 0);
        const totalPending = Math.max(0, totalAssigned - totalPaid);

        res.json({
            student,
            fees,
            summary: {
                totalAssigned,
                totalPaid,
                totalPending
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`School Fee Management running at http://localhost:${PORT}`);
});
