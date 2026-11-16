# Business Suite: ERP + CRM + HRMS + Finance + Projects

Ek hi web dashboard, alag-alag login ke saath. Plain Node.js me bana hai, data JSON files me save hota hai.
Koi database ya extra package install nahi karna (`npm install` ki zaroorat nahi).

## Chalane ka tareeka

1. **Node.js install karo** (version 18 ya usse naya): https://nodejs.org se "LTS" download karke install karo.
2. Is folder ko kahin bhi rakh do (jaise `C:\business-suite`).
3. **Windows:** `start.bat` par double-click karo.
   **Mac / Linux:** terminal me is folder ke andar `node server.js` chalao.
4. Browser me kholo: **http://localhost:3000**
5. Pehli baar "Create the owner account" screen aayegi. Company ka naam, apna naam, owner login ID aur password daalo.
   - "Create the four team logins now" tick rahega to `erp`, `crm`, `hrms`, `finance` login ban jaate hain. Unke password **sirf ek baar** agli screen par dikhte hain, wahin note kar lo ya text file download kar lo.
   - "Load sample data" tick rahega to example records aa jaate hain. Baad me owner ek click se hata sakta hai.

Server band karne ke liye us window me `Ctrl+C` dabao. Jab tak window khuli hai, app chalta rahega.

## Kaun sa login kya kholta hai

| Login | Kya dikhta hai |
|---|---|
| **Owner** | Sab kuch: Overview, Daily Work Report, Projects Hub, ERP, CRM, HRMS, Finance, aur "Logins and access" |
| **DAILY WORK REPORT** | **Daily Work Reports**, **Assign Work & Tasks**, **Project Hub & Deadlines** |
| **ERP** | ERP dashboard, Inventory, Stock issue register, Who holds what, Sales invoices, Purchases |
| **CRM** | CRM dashboard, Leads, Pipeline, Customers |
| **HRMS** | HR dashboard, Employees & ID Cards, Attendance, Leave, Payroll |
| **Finance** | Finance dashboard, Money to collect, Expenses |
| **Projects** | All projects, progress, deadlines |
| **Employee (ESS)** | My Dashboard (Check-in), My Assigned Tasks, Daily Work Updates, My Attendance, Apply Leave, Salary Slips, My Digital ID Card |

## Naya Employee Lifecycle Workflow

1. **Step 1: Employee Add karo:**
   - Full Name, Role / Designation (kis role ke liye hire ho raha hai), Email aur basic details daalo.
   - Save hote hi Portal Login ID aur Temporary Password apne aap ban jaata hai.
2. **Step 2: Welcome Email & Temporary Password:**
   - Direct "Send Welcome Email" button se employee ke email par login credentials aur portal link chala jaata hai.
   - WhatsApp / SMS par bhejne ke liye "Copy Details" button bhi milta hai.
3. **Step 3: Registered Employee Profile & Original Documents:**
   - Profile me photo upload karo.
   - Original documents upload karo: Aadhaar Card, PAN Card, Resume / CV, Offer Letter, Certificates, Address Proof (PDF / Images).
4. **Step 4: ID Card Generator:**
   - Single-click se standard CR-80 company ID Card generate hota hai (Photo, Name, Role, ID Code, Blood Group, QR code aur Authorized Signature ke saath).
   - "Print / Save PDF" dabakar direct print nikaalo.
5. **Step 5: Employee Self-Service (ESS) Portal:**
   - Employee apne Login ID aur Temporary Password se sign in karta hai:
     - **Attendance:** Daily Check-In / Mark Present / Half Day.
     - **Leave:** Chhutti (leave) apply karna aur approval status dekhna.
     - **Salary Slips:** Monthly payslip dekhna aur PDF download/print karna.
     - **Daily Work Reports:** "Kal kya kiya tha" aur "Aaj kya kaam hai" update submit karna.
     - **My ID Card:** Apna digital ID Card dekhna aur print karna.

## Official Email & CRM Client Communications (`rvmaitech2026@gmail.com`)

- **Official Sender Email:** `rvmaitech2026@gmail.com`
  - Chahe employee welcome email ho ya CRM lead/customer quotation, sabhi emails `rvmaitech2026@gmail.com` se dispatch hote hain.
- **CRM Email Feature:**
  - CRM Dashboard, Leads list, Pipeline board aur Customers list se staff direct client ko email bhej sakta hai.
  - Ready-made templates: Parking Quotations & Proposals, Site Inspection Follow-ups, Meeting Confirmations, aur Introductions.
  - 1-Click "Send Email Now", "Open in Gmail Web", aur "Copy Message" options.
  - Sent history CRM Dashboard par live track hoti hai.

Yeh rok sirf screen par nahi, server par bhi lagi hai: ERP login ko salary, address ya documents ka data server bhejta hi nahi.
Naya login banana, access badalna, password reset karna: Owner > Admin > Logins and access.

## Team ke doosre computer / phone se kholna

Server chalu hone par window me "On your network: http://192.168.x.x:3000" jaisa address dikhta hai.
Usi Wi-Fi / LAN par jo bhi computer ya phone hai, woh us address se login kar sakta hai.
(Agar na khule to Windows Firewall me Node.js ko "Private network" par allow karo.)

Pehli baar ka setup agar kisi doosre computer se kar rahe ho to 6-digit "setup code" maanga jaayega. Woh server wali window me likha hota hai.

## Data kahan save hota hai

- `data/db.json`: saare records (products, invoices, employees, projects, logins...)
- `data/uploads/`: employee ke photo aur documents
- `data/backups/`: har din ka ek purana copy apne aap banta hai (pichhle 14 din)
- `data/sessions.json`: kaun login hai

**Backup:** poora `data` folder copy karke pen drive / Google Drive me rakh lo. Naye computer par shift karna ho to yahi folder wahan rakh do.
Passwords `db.json` me scrambled (scrypt hash) save hote hain, padhe nahi ja sakte. Owner ka password bhool gaye to wapas nahi milega, isliye sambhaal kar rakho.

## Settings

- Port badalna: Windows `set PORT=4000 && node server.js`, Mac/Linux `PORT=4000 node server.js`
- Data folder kahin aur rakhna: `DATA_DIR=D:\suite-data`

## Zaroori baatein (limits)

- **Internet par seedha mat kholo.** Yeh `http` par chalta hai. Office ke bahar se use karna ho to ise kisi server par HTTPS (jaise Nginx / Caddy reverse proxy) ke peeche lagwao, warna password raste me padha ja sakta hai.
- JSON file storage chhoti team ke liye theek hai (kuch dozen log, hazaaron records). Bahut bada data ho to database (PostgreSQL / MyS![alt text](image.png)QL) par shift karna chahiye.
- Payroll me PF aur professional tax simple estimate hain. Pay karne se pehle accountant se mila lo.
- Finance dashboard ka "Estimated surplus" ek andaza hai, final accounts nahi.
- Uploads: JPG, PNG, WEBP ya PDF, har file 8 MB tak.
- Invoice ka print / PDF, email aur SMS abhi nahi hai.

## Developer ke liye

```
server.js        HTTP server, routes, static files (koi dependency nahi)
lib/schema.js    har list ke fields, kaun padh/likh sakta hai, save se pehle ke checks
lib/auth.js      scrypt passwords, sessions (HttpOnly cookie), login rate limit
lib/store.js     JSON file: atomic write + daily backup
lib/seed.js      sample data
public/          frontend (plain HTML, CSS, JS; koi build step nahi)
```

Naya field ya list jodna ho to pehle `lib/schema.js` me add karo, phir `public/js/` ki screen me.
