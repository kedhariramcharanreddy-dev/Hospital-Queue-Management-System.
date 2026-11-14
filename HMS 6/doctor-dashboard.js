const API = "";
const getSession = () => {
    try { return JSON.parse(localStorage.getItem("hmsUser") || "{}"); }
    catch { return {}; }
};
const session = getSession();
const $ = id => document.getElementById(id);

function setNotice(message, error = false) {
    $("connection").textContent = message;
    $("connection").classList.toggle("error", error);
}
function setTokenMessage(message, error = false) {
    const el = $("token-message");
    el.textContent = message;
    el.classList.toggle("error", error);
}
async function api(path, method = "GET", body) {
    const response = await fetch(API + path, {
        method,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || data.error || `Request failed (${response.status})`);
    return data;
}
function safe(value) {
    return String(value ?? "—").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
}
function setCounts(rows) {
    $("total").textContent = rows.filter(row => !["Completed", "Skipped"].includes(row.status)).length;
    $("consulting").textContent = rows.filter(row => row.status === "In Consultation").length;
    $("completed").textContent = rows.filter(row => row.status === "Completed").length;
}
function rowHTML(patient) {
    const id = patient.id ?? patient.queue_id;
    const status = patient.status || "Waiting";
    return `<tr>
      <td><b>${safe(patient.token_number ?? patient.tokenNumber ?? "—")}</b></td>
      <td>${safe(patient.patient_name ?? patient.name ?? "Patient")}</td>
      <td>${safe(patient.department ?? "—")}</td>
      <td><span class="status">${safe(status)}</span></td>
      <td><div class="actions">
        <button class="action" data-action="consult" data-id="${safe(id)}">Consult</button>
        <button class="action green" data-action="complete" data-id="${safe(id)}">Complete</button>
        <button class="action gray" data-action="skip" data-id="${safe(id)}">Skip</button>
        <button class="action gray" data-action="recall" data-id="${safe(id)}">Recall</button>
      </div></td>
    </tr>`;
}
async function loadPatients() {
    const select = $("patient-select");
    try {
        const data = await api("/api/queue/patients");
        const patients = data.patients || [];
        select.innerHTML = '<option value="">Select a patient</option>' +
            patients.map(patient =>
                `<option value="${safe(patient.id)}">${safe(patient.name)} — ${safe(patient.email)}</option>`
            ).join("");
        if (!patients.length) select.innerHTML = '<option value="">No registered patients found</option>';
    } catch (error) {
        select.innerHTML = '<option value="">Could not load patients</option>';
        setTokenMessage(error.message, true);
    }
}
async function loadQueue() {
    try {
        const doctorId = session.id ?? session.doctor_id ?? session.doctorId;
        if (!doctorId) throw Error("Doctor ID is missing. Please log in again.");
        const data = await api(`/api/queue/doctor/${encodeURIComponent(doctorId)}`);
        const rows = Array.isArray(data) ? data : (data.queue || data.patients || []);
        const doctorName = session.name || session.doctor_name || "Doctor";
        $("doctor-name").textContent = /^dr\.?\s/i.test(doctorName) ? doctorName : `Dr. ${doctorName}`;
        $("side-name").textContent = doctorName;
        setCounts(rows);
        $("queue-body").innerHTML = rows.length
            ? rows.map(rowHTML).join("")
            : '<tr><td colspan="5" class="empty">No patients in your queue.</td></tr>';
        setNotice("Doctor queue loaded successfully.");
    } catch (error) {
        setNotice(`${error.message} Confirm that the Node.js backend is running.`, true);
        $("queue-body").innerHTML = '<tr><td colspan="5" class="empty">Queue could not be loaded. Check the backend connection.</td></tr>';
    }
}

$("token-form").addEventListener("submit", async event => {
    event.preventDefault();
    const patientId = $("patient-select").value;
    if (!patientId) {
        setTokenMessage("Please select a patient first.", true);
        return;
    }
    const button = $("generate-token-button");
    button.disabled = true;
    button.textContent = "Generating…";
    try {
        const data = await api("/api/queue/generate", "POST", { patientId: Number(patientId) });
        const queue = data.queue;
        setTokenMessage(`Token ${queue.tokenNumber} generated for ${queue.patientName}. The patient can now see it on their dashboard.`);
        await loadQueue();
    } catch (error) {
        setTokenMessage(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = "Generate Token";
    }
});

$("queue-body").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!id || id === "undefined") {
        setNotice("Queue record ID is missing.", true);
        return;
    }
    const routes = {
        consult: ["/api/queue/status/" + id, { status: "In Consultation" }],
        complete: ["/api/queue/end/" + id, {}],
        skip: ["/api/queue/skip/" + id, {}],
        recall: ["/api/queue/recall/" + id, {}]
    };
    const [path, body] = routes[action];
    button.disabled = true;
    try {
        await api(path, "PUT", body);
        setNotice("Queue updated successfully.");
        await loadQueue();
    } catch (error) {
        setNotice(error.message, true);
    } finally {
        button.disabled = false;
    }
});

$("refresh").addEventListener("click", async () => {
    await loadPatients();
    await loadQueue();
});
$("logout").addEventListener("click", () => {
    localStorage.removeItem("hmsUser");
    location.href = "doct.html";
});

if (session.role !== "doctor" || !session.token) {
    location.href = "doct.html";
} else {
    loadPatients();
    loadQueue();
}
