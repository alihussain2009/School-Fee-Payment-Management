-- School Fee Payment Management System
-- Database Schema & Sample Data

CREATE DATABASE IF NOT EXISTS school_fee_management;
USE school_fee_management;

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    studentid INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    class VARCHAR(50) NOT NULL,
    rollno VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fee Details Table
CREATE TABLE IF NOT EXISTS feedetails (
    feeid INT AUTO_INCREMENT PRIMARY KEY,
    studentid INT NOT NULL,
    academicyear VARCHAR(20) NOT NULL,
    feetype VARCHAR(50) NOT NULL,
    totalamount DECIMAL(10, 2) NOT NULL,
    duedate DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fee_student FOREIGN KEY (studentid) REFERENCES students(studentid) ON DELETE CASCADE
);

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    paymentid INT AUTO_INCREMENT PRIMARY KEY,
    feeid INT NOT NULL,
    amountpaid DECIMAL(10, 2) NOT NULL,
    paymentdate DATE NOT NULL,
    paymentmethod VARCHAR(50) NOT NULL,
    receiptno VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_fee FOREIGN KEY (feeid) REFERENCES feedetails(feeid) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_rollno ON students(rollno);
CREATE INDEX IF NOT EXISTS idx_feedetails_student ON feedetails(studentid);
CREATE INDEX IF NOT EXISTS idx_payments_fee ON payments(feeid);

