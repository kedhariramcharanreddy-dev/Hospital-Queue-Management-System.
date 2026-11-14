HOSPITAL QUEUE MANAGEMENT SYSTEM (HMS)

PROJECT CONTENTS
- index.html / index.css: home page
- patient-register.html: patient registration page
- doctor-register.html: doctor registration page
- account-register.css: shared registration page styling
- patlogin.html / patlogin.css: patient login
- doct.html / doct.css: doctor login
- patient-dashboard.html / patient-dashboard.js: patient queue dashboard
- doctor-dashboard.html / doctor-dashboard.js: doctor queue dashboard
- dashboard.css: dashboard styling
- server.js: Express application entry point
- db.js: MySQL connection pool
- routes/auth.js: patient and doctor registration plus patient/doctor login APIs
- routes/queue.js: patient queue and doctor queue/action APIs
- middleware/auth.js: JWT authentication middleware

REQUIREMENTS
- Node.js
- MySQL

SETUP
1. Open this folder in VS Code.
2. Open Terminal in this folder and run: npm install
3. Copy .env.example to a new file named .env.
4. Edit .env and enter your own MySQL root password and a long random JWT_SECRET.
   Do not share the .env file or publish it to GitHub.
5. Make sure your MySQL database is named hospital_queue and has the tables
   Users, Queue, and Notifications with the columns used by the application.
   The Analytics table can remain for your reporting feature.
6. Start the server: npm start
7. Open http://localhost:3000 in your browser.

LOGIN PAGES
Patient login: http://localhost:3000/patlogin.html
Doctor login:  http://localhost:3000/doct.html
Patient dashboard: http://localhost:3000/patient-dashboard.html
Doctor dashboard:  http://localhost:3000/doctor-dashboard.html

NOTES
- The .env file and node_modules are intentionally not included. npm install recreates
  dependencies, and you must create your own .env from .env.example.
- Queue dashboards require valid login sessions and existing queue records.
- Estimated waiting time is a simple estimate of 10 minutes per patient ahead.


ACCOUNT REGISTRATION PAGES
- Home page: http://localhost:3000/
- Patient registration: http://localhost:3000/patient-register.html
- Doctor registration: http://localhost:3000/doctor-register.html
- Patient login: http://localhost:3000/patlogin.html
- Doctor login: http://localhost:3000/doct.html

The home page contains separate links for patient and doctor registration. Patient registration uses POST /api/auth/register. Doctor registration uses POST /api/auth/register-doctor and stores the selected department. Both registration pages redirect to their matching login page after successful registration.


AUTOMATIC DOCTOR TOKEN GENERATION
- Sign in using a doctor account and open the Doctor Dashboard.
- In "Generate patient token", choose a registered patient and click "Generate Token".
- The backend creates the next token number for that doctor's queue for the current date.
- A patient cannot receive a second active token from the same doctor on the same day.
- A notification is saved for the patient, and the token appears on the patient's dashboard.
- Only authenticated doctor accounts can list patients and generate tokens.
- Existing Queue and Notifications tables are used; no new table is required.
