const API = "/api";

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API + url, {
            headers: { "Content-Type": "application/json" },
            ...options
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || data.message || `Request failed (${response.status})`);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

function formatMoney(amount) {
    const num = Number(amount) || 0;
    return "₹" + num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function showMessage(message) {
    alert(message);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboard() {
    const studentsElement = document.getElementById("totalStudents");
    if (!studentsElement) return;

    try {
        const data = await apiRequest("/dashboard");

        document.getElementById("totalStudents").textContent = data.totalStudents;
        document.getElementById("totalFees").textContent = formatMoney(data.totalFees);
        document.getElementById("collectedFees").textContent = formatMoney(data.collectedFees);
        document.getElementById("pendingFees").textContent = formatMoney(data.pendingFees);
    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

// ==========================================
// STUDENTS
// ==========================================

async function loadStudents() {
    const table = document.getElementById("studentsTableBody");
    if (!table) return;

    try {
        const students = await apiRequest("/students");

        const countEl = document.getElementById("studentCount");
        if (countEl) {
            countEl.textContent = `${students.length} Student${students.length === 1 ? "" : "s"}`;
        }

        if (students.length === 0) {
            table.innerHTML = '<tr><td colspan="7" class="empty-cell">No students registered yet.</td></tr>';
            return;
        }

        table.innerHTML = students.map(student => `
            <tr>
                <td>${student.studentid}</td>
                <td><strong>${escapeHTML(student.name)}</strong></td>
                <td>${escapeHTML(student.class)}</td>
                <td>${escapeHTML(student.rollno)}</td>
                <td>${escapeHTML(student.phone)}</td>
                <td>${escapeHTML(student.email || "-")}</td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="editStudent(${student.studentid})">
                            Edit
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="deleteStudent(${student.studentid})">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        table.innerHTML = '<tr><td colspan="7" class="empty-cell">Unable to load students.</td></tr>';
        showMessage(error.message);
    }
}

const studentForm = document.getElementById("studentFormElement");

if (studentForm) {
    studentForm.addEventListener("submit", async event => {
        event.preventDefault();

        const studentid = document.getElementById("studentid").value;

        const student = {
            name: document.getElementById("name").value.trim(),
            class: document.getElementById("class").value.trim(),
            rollno: document.getElementById("rollno").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: document.getElementById("email").value.trim()
        };

        try {
            if (studentid) {
                await apiRequest("/students/" + studentid, {
                    method: "PUT",
                    body: JSON.stringify(student)
                });
                showMessage("Student updated successfully!");
            } else {
                await apiRequest("/students", {
                    method: "POST",
                    body: JSON.stringify(student)
                });
                showMessage("Student registered successfully!");
            }

            studentForm.reset();
            document.getElementById("studentid").value = "";
            const submitBtn = document.getElementById("studentSubmit");
            if (submitBtn) submitBtn.textContent = "Save Student →";
            loadStudents();

        } catch (error) {
            showMessage(error.message);
        }
    });
}

async function editStudent(id) {
    try {
        const students = await apiRequest("/students");
        const student = students.find(item => item.studentid === id);

        if (!student) {
            showMessage("Student not found.");
            return;
        }

        document.getElementById("studentid").value = student.studentid;
        document.getElementById("name").value = student.name;
        document.getElementById("class").value = student.class;
        document.getElementById("rollno").value = student.rollno;
        document.getElementById("phone").value = student.phone;
        document.getElementById("email").value = student.email || "";

        const submitBtn = document.getElementById("studentSubmit");
        if (submitBtn) submitBtn.textContent = "Update Student →";

        const formCard = document.getElementById("studentForm");
        if (formCard) formCard.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
        showMessage(error.message);
    }
}

async function deleteStudent(id) {
    if (!confirm("Are you sure you want to delete this student? All associated fee and payment records will also be removed.")) {
        return;
    }

    try {
        await apiRequest("/students/" + id, { method: "DELETE" });
        showMessage("Student deleted successfully!");
        loadStudents();
    } catch (error) {
        showMessage(error.message);
    }
}

const resetStudentButton = document.getElementById("resetStudent");

if (resetStudentButton) {
    resetStudentButton.addEventListener("click", () => {
        document.getElementById("studentid").value = "";
        const submitBtn = document.getElementById("studentSubmit");
        if (submitBtn) submitBtn.textContent = "Save Student →";
    });
}

// ==========================================
// FEE MANAGEMENT
// ==========================================

async function loadFeeStudents() {
    const select = document.getElementById("feeStudent");
    if (!select) return;

    try {
        const students = await apiRequest("/students");

        select.innerHTML = '<option value="">Select a student</option>' +
            students.map(student => `
                <option value="${student.studentid}">
                    ${escapeHTML(student.name)} (Roll: ${escapeHTML(student.rollno)} | Class: ${escapeHTML(student.class)})
                </option>
            `).join("");

    } catch (error) {
        console.error("Fee students load error:", error);
    }
}

async function loadFees() {
    const table = document.getElementById("feesTableBody");
    if (!table) return;

    try {
        const fees = await apiRequest("/fees");

        const countEl = document.getElementById("feeCount");
        if (countEl) {
            countEl.textContent = `${fees.length} Record${fees.length === 1 ? "" : "s"}`;
        }

        if (fees.length === 0) {
            table.innerHTML = '<tr><td colspan="8" class="empty-cell">No fee records found.</td></tr>';
            return;
        }

        table.innerHTML = fees.map(fee => `
            <tr>
                <td>${fee.feeid}</td>
                <td><strong>${escapeHTML(fee.name || fee.studentname || "-")}</strong></td>
                <td>${escapeHTML(fee.rollno || "-")}</td>
                <td><span class="badge badge-outline">${escapeHTML(fee.feetype)}</span></td>
                <td>${formatMoney(fee.totalamount)}</td>
                <td class="text-success">${formatMoney(fee.paidamount || fee.amountpaid || 0)}</td>
                <td class="${Number(fee.pendingamount) > 0 ? 'status-pending' : 'text-success'}">${formatMoney(fee.pendingamount)}</td>
                <td>${formatDate(fee.duedate)}</td>
            </tr>
        `).join("");

    } catch (error) {
        table.innerHTML = '<tr><td colspan="8" class="empty-cell">Unable to load fee records.</td></tr>';
        showMessage(error.message);
    }
}

const feeForm = document.getElementById("feeForm");

if (feeForm) {
    feeForm.addEventListener("submit", async event => {
        event.preventDefault();

        const fee = {
            studentid: document.getElementById("feeStudent").value,
            academicyear: document.getElementById("academicyear").value.trim(),
            feetype: document.getElementById("feetype").value.trim(),
            totalamount: document.getElementById("totalamount").value,
            duedate: document.getElementById("duedate").value
        };

        try {
            await apiRequest("/fees", {
                method: "POST",
                body: JSON.stringify(fee)
            });

            showMessage("Fee assigned successfully!");
            feeForm.reset();
            loadFees();
            loadPaymentFeeOptions();

        } catch (error) {
            showMessage(error.message);
        }
    });
}

// ==========================================
// PAYMENTS
// ==========================================

let allFeesList = [];

async function loadPaymentFeeOptions() {
    const select = document.getElementById("paymentFee");
    if (!select) return;

    try {
        allFeesList = await apiRequest("/fees");

        select.innerHTML = '<option value="">Select Fee Record</option>' +
            allFeesList.map(fee => {
                const studentName = fee.name || fee.studentname || "Student #" + fee.studentid;
                const pending = Number(fee.pendingamount || 0);
                return `
                    <option value="${fee.feeid}" data-pending="${pending}">
                        #${fee.feeid} - ${escapeHTML(studentName)} (${escapeHTML(fee.feetype)}) - Pending: ${formatMoney(pending)}
                    </option>
                `;
            }).join("");

        // Set default date to today
        const dateInput = document.getElementById("paymentdate");
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split("T")[0];
        }

    } catch (error) {
        console.error("Payment fee options error:", error);
    }
}

const paymentFeeSelect = document.getElementById("paymentFee");
if (paymentFeeSelect) {
    paymentFeeSelect.addEventListener("change", () => {
        const selectedOption = paymentFeeSelect.options[paymentFeeSelect.selectedIndex];
        const pendingAmount = selectedOption ? selectedOption.getAttribute("data-pending") : null;
        const amountInput = document.getElementById("amountpaid");
        if (amountInput && pendingAmount && Number(pendingAmount) > 0) {
            amountInput.placeholder = `Max: ${formatMoney(pendingAmount)}`;
            amountInput.max = pendingAmount;
        }
    });
}

async function loadPayments() {
    const table = document.getElementById("paymentsTableBody");
    if (!table) return;

    try {
        const payments = await apiRequest("/payments");

        const countEl = document.getElementById("paymentCount");
        if (countEl) {
            countEl.textContent = `${payments.length} Payment${payments.length === 1 ? "" : "s"}`;
        }

        if (payments.length === 0) {
            table.innerHTML = '<tr><td colspan="7" class="empty-cell">No payments recorded yet.</td></tr>';
            return;
        }

        table.innerHTML = payments.map(payment => `
            <tr>
                <td>#${payment.paymentid}</td>
                <td><strong>${escapeHTML(payment.name || payment.studentname || "-")}</strong></td>
                <td><span class="badge badge-outline">${escapeHTML(payment.feetype || "-")}</span></td>
                <td class="text-success font-bold">${formatMoney(payment.amountpaid)}</td>
                <td>${formatDate(payment.paymentdate)}</td>
                <td><span class="badge badge-info">${escapeHTML(payment.paymentmethod)}</span></td>
                <td><code>${escapeHTML(payment.receiptno)}</code></td>
            </tr>
        `).join("");

    } catch (error) {
        table.innerHTML = '<tr><td colspan="7" class="empty-cell">Unable to load payments.</td></tr>';
        showMessage(error.message);
    }
}

const paymentForm = document.getElementById("paymentForm");

if (paymentForm) {
    paymentForm.addEventListener("submit", async event => {
        event.preventDefault();

        const payment = {
            feeid: document.getElementById("paymentFee").value,
            amountpaid: document.getElementById("amountpaid").value,
            paymentdate: document.getElementById("paymentdate").value,
            paymentmethod: document.getElementById("paymentmethod").value,
            receiptno: document.getElementById("receiptno").value.trim()
        };

        try {
            await apiRequest("/payments", {
                method: "POST",
                body: JSON.stringify(payment)
            });

            showMessage("Payment recorded successfully!");
            paymentForm.reset();
            loadPayments();
            loadPaymentFeeOptions();

        } catch (error) {
            showMessage(error.message);
        }
    });
}

// ==========================================
// PENDING FEES
// ==========================================

async function loadPendingFees() {
    const table = document.getElementById("pendingTableBody");
    if (!table) return;

    try {
        const records = await apiRequest("/pending");

        const countEl = document.getElementById("pendingCount");
        if (countEl) {
            countEl.textContent = `${records.length} Record${records.length === 1 ? "" : "s"}`;
        }

        if (records.length === 0) {
            table.innerHTML = '<tr><td colspan="9" class="empty-cell">No pending fees! All accounts are up to date.</td></tr>';
            return;
        }

        table.innerHTML = records.map(record => `
            <tr>
                <td>${record.studentid}</td>
                <td><strong>${escapeHTML(record.name || record.studentname)}</strong></td>
                <td>${escapeHTML(record.class || "-")}</td>
                <td>${escapeHTML(record.rollno || "-")}</td>
                <td><span class="badge badge-outline">${escapeHTML(record.feetype)}</span></td>
                <td>${formatMoney(record.totalamount)}</td>
                <td class="text-success">${formatMoney(record.paidamount ?? record.amountpaid ?? 0)}</td>
                <td class="status-pending">${formatMoney(record.pendingamount)}</td>
                <td>${formatDate(record.duedate)}</td>
            </tr>
        `).join("");

    } catch (error) {
        table.innerHTML = '<tr><td colspan="9" class="empty-cell">Unable to load pending fees.</td></tr>';
        showMessage(error.message);
    }
}

// ==========================================
// REPORTS
// ==========================================

async function loadReportStudents() {
    const select = document.getElementById("reportStudent");
    if (!select) return;

    try {
        const students = await apiRequest("/students");

        select.innerHTML = '<option value="">Select Student</option>' +
            students.map(student => `
                <option value="${student.studentid}">
                    ${escapeHTML(student.name)} (Roll: ${escapeHTML(student.rollno)} | Class: ${escapeHTML(student.class)})
                </option>
            `).join("");

    } catch (error) {
        console.error("Report students error:", error);
    }
}

const reportForm = document.getElementById("reportForm");

if (reportForm) {
    reportForm.addEventListener("submit", async event => {
        event.preventDefault();

        const studentId = document.getElementById("reportStudent").value;
        if (!studentId) {
            showMessage("Please select a student first.");
            return;
        }

        try {
            const report = await apiRequest("/reports/" + studentId);
            const container = document.getElementById("reportResult");

            const student = report.student;
            const fees = report.fees || [];
            const summary = report.summary || {
                totalAssigned: fees.reduce((sum, f) => sum + Number(f.totalamount || 0), 0),
                totalPaid: fees.reduce((sum, f) => sum + Number(f.amountpaid || f.paidamount || 0), 0),
                totalPending: fees.reduce((sum, f) => sum + Number(f.pendingamount || 0), 0)
            };

            container.innerHTML = `
                <div class="report-card printable-area">
                    <div class="report-header">
                        <div>
                            <h2>Student Fee Statement</h2>
                            <p>Official School Fee Record</p>
                        </div>
                        <div class="report-badge">Report Date: ${formatDate(new Date())}</div>
                    </div>

                    <div class="report-details-grid">
                        <div class="report-field">
                            <span class="report-label">Student ID</span>
                            <span class="report-value">${student.studentid}</span>
                        </div>
                        <div class="report-field">
                            <span class="report-label">Student Name</span>
                            <span class="report-value"><strong>${escapeHTML(student.name)}</strong></span>
                        </div>
                        <div class="report-field">
                            <span class="report-label">Class</span>
                            <span class="report-value">${escapeHTML(student.class)}</span>
                        </div>
                        <div class="report-field">
                            <span class="report-label">Roll Number</span>
                            <span class="report-value">${escapeHTML(student.rollno)}</span>
                        </div>
                        <div class="report-field">
                            <span class="report-label">Phone</span>
                            <span class="report-value">${escapeHTML(student.phone)}</span>
                        </div>
                        <div class="report-field">
                            <span class="report-label">Email</span>
                            <span class="report-value">${escapeHTML(student.email || "-")}</span>
                        </div>
                    </div>

                    <div class="report-summary-bar">
                        <div class="summary-box">
                            <small>Total Fee Assigned</small>
                            <strong>${formatMoney(summary.totalAssigned)}</strong>
                        </div>
                        <div class="summary-box text-success">
                            <small>Total Amount Paid</small>
                            <strong>${formatMoney(summary.totalPaid)}</strong>
                        </div>
                        <div class="summary-box status-pending">
                            <small>Total Balance Due</small>
                            <strong>${formatMoney(summary.totalPending)}</strong>
                        </div>
                    </div>

                    <h3 class="report-subheading">Assigned Fee Records & Payments</h3>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fee ID</th>
                                    <th>Academic Year</th>
                                    <th>Fee Type</th>
                                    <th>Total Fee</th>
                                    <th>Paid Amount</th>
                                    <th>Pending Balance</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fees.length ? fees.map(fee => `
                                    <tr>
                                        <td>#${fee.feeid}</td>
                                        <td>${escapeHTML(fee.academicyear)}</td>
                                        <td><span class="badge badge-outline">${escapeHTML(fee.feetype)}</span></td>
                                        <td>${formatMoney(fee.totalamount)}</td>
                                        <td class="text-success">${formatMoney(fee.amountpaid || fee.paidamount || 0)}</td>
                                        <td class="${Number(fee.pendingamount) > 0 ? 'status-pending' : 'text-success'}">
                                            ${formatMoney(fee.pendingamount)}
                                        </td>
                                        <td>${formatDate(fee.duedate)}</td>
                                    </tr>
                                `).join("") : '<tr><td colspan="7" class="empty-cell">No fee records found for this student.</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="report-footer-note">
                        <p>This is a computer generated document from EduPay School Fee Payment Management System.</p>
                    </div>
                </div>
            `;

        } catch (error) {
            showMessage(error.message);
        }
    });
}

const printButton = document.getElementById("printReport");

if (printButton) {
    printButton.addEventListener("click", () => {
        if (!document.querySelector("#reportResult .report-card")) {
            showMessage("Please generate a report first before printing.");
            return;
        }

        window.print();
    });
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    loadStudents();
    loadFeeStudents();
    loadFees();
    loadPaymentFeeOptions();
    loadPayments();
    loadPendingFees();
    loadReportStudents();
});
