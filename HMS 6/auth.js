// Login handler for the patient and doctor login pages.
const loginForm = document.querySelector("form");

if (loginForm && (document.body.dataset.loginRole === "patient" || document.body.dataset.loginRole === "doctor")) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const role = document.body.dataset.loginRole;
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value;

        if (!email || !password) {
            showMessage("Please enter your email and password.", true);
            return;
        }

        const submitButton = loginForm.querySelector('input[type="submit"], button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            if (submitButton.tagName === "INPUT") submitButton.value = "Logging in...";
            else submitButton.textContent = "Logging in...";
        }

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ email, password, role })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "Login failed. Please check your details.");

            // Keep the authenticated user and token for the dashboard.
            localStorage.setItem("hmsUser", JSON.stringify({
                ...data.user,
                token: data.token
            }));

            window.location.href = role === "patient"
                ? "patient-dashboard.html"
                : "doctor-dashboard.html";
        } catch (error) {
            showMessage(error.message || "Unable to connect to the server.", true);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                if (submitButton.tagName === "INPUT") submitButton.value = "Login";
                else submitButton.textContent = "Login";
            }
        }
    });
}

function showMessage(message, isError) {
    let element = document.getElementById("auth-message");
    if (!element) {
        element = document.createElement("p");
        element.id = "auth-message";
        element.setAttribute("role", "alert");
        const form = document.querySelector("form");
        if (form) form.prepend(element);
    }
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#18794e";
    element.style.margin = "10px 0";
}

// Registration handler for the separate patient and doctor registration pages.
const registrationForm = document.getElementById("register-form");
if (registrationForm) {
    registrationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const role = document.body.dataset.registerRole;
        const payload = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
            contact: document.getElementById("contact").value.trim()
        };
        if (role === "doctor") payload.department = document.getElementById("department").value;

        const button = registrationForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Creating account...";
        try {
            const endpoint = role === "doctor" ? "/api/auth/register-doctor" : "/api/auth/register";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "Registration failed");
            showMessage(data.message + " You can now log in.", false);
            registrationForm.reset();
            setTimeout(() => { window.location.href = role === "doctor" ? "doct.html" : "patlogin.html"; }, 1200);
        } catch (error) {
            showMessage(error.message || "Unable to connect to the server.", true);
        } finally {
            button.disabled = false;
            button.textContent = role === "doctor" ? "Create Doctor Account" : "Create Patient Account";
        }
    });
}
