# HRIS Kemika

Prompt Title:
Kemika HR Attendance System – GPS & Face Recognition Attendance App




Prompt Description:
Aplikasi absensi digital karyawan berbasis web dan mobile dengan fitur deteksi lokasi (GPS), face recognition, cuti, lembur, dan dashboard real-time untuk HRGA PT. Kemika Karya Pratama.




Prompt Content (copy all below):




Build a mobile-first HR attendance web app named Kemika HR Attendance System, for PT. Kemika Karya Pratama.




The app must have two roles:




Admin HRGA (Web Dashboard)




Employee / Karyawan (Mobile View)




🔐 Authentication




Email & password login using Firebase Authentication.




Only Admin can add employee accounts.




Role-based access control.




🧑‍💼 Employee Management




Admin can:




Add/Edit/Delete employee data.




Fields: Name, NIK, Email, Jabatan, Departemen, Join Date, Address, Phone, Photo (Face recognition image), Status (Active/Inactive), Annual Leave Quota (12).




Export employee database to Excel.




🕒 GPS & Face Recognition Attendance




Employees Check-In and Check-Out using camera and GPS.




Validate real-time face recognition (FaceIO / Azure Face API) and GPS radius ≤ 100m from office.




Store timestamp, GPS location, and photo validation result in Firestore.




Show live status: “Hadir”, “Terlambat”, “Pulang Cepat”, or “Tidak Hadir”.




📍 Live Attendance Dashboard (Admin)




Map view of active employees (Google Maps API).




Table: Name, Department, Check-In, Check-Out, Duration, Status, GPS Match.




Charts: Attendance trend (daily, weekly, monthly) using Chart.js or Recharts.




📆 Leave & Permission Module




Types: Cuti Tahunan (12 days/year), Izin, Sakit, Lupa Absen.




Employees can submit leave requests with date range & reason.




Admin can Approve/Reject requests.




Automatically deduct annual leave balance when approved.




⏱️ Overtime (Lembur)




Employees can apply overtime (date, hours, reason).




Admin approves/rejects.




Calculate total overtime hours per employee.




🔔 Real-Time Notifications




Use Firebase Cloud Messaging (FCM).




Notify:




Employee: Approval/Rejection of leave or overtime.




Admin: Employee Check-In / Check-Out.




Reminder: “Belum Check-In hingga jam 09.00.”




📊 Reports & Analytics




Exportable attendance and leave reports by date range (Excel/PDF).




Summary metrics: Total hadir, terlambat, lembur hours, cuti usage.




🧭 UI / UX Design




Modern, responsive dashboard.




Theme color: Blue (#0047AB) & White (Kemika corporate style).




Admin (Web): Sidebar navigation with sections — Dashboard, Employees, Attendance, Leave, Overtime, Reports, Notifications, Settings.




Employee (Mobile): Home (Check-In/Out), Attendance History, Leave Request, Overtime Request, Profile, Notifications.




Show real-time clock and location pin at check-in.




☁️ Backend & Database (Firebase / Supabase)




Collections:




users: user data & roles




attendance: check-in/out records




leave_requests: leave & permission submissions




overtime_requests: overtime data




notifications: system notifications




Include API endpoints:




/auth/login, /auth/register




/attendance/checkin, /attendance/checkout, /attendance/today




/leave/apply, /leave/approve/:id




/overtime/apply, /overtime/approve/:id




/notification/push




/report/attendance/:month




⚙️ Features Summary




GPS & face recognition validation (AI-powered).




Role-based login (Admin & Employee).




Time-off, overtime, and forget-to-check attendance requests.




Real-time notifications.




Responsive, mobile-friendly UI.




Exportable analytics & reports.




🧩 Tech Stack




Frontend: React + Tailwind CSS (or FlutterFlow if mobile).




Backend: Firebase Firestore / Supabase + Functions.




AI/ML: FaceIO / Azure Cognitive Services.




GPS: HTML5 Geolocation API / Flutter Geolocator.




Notifications: Firebase Cloud Messaging (FCM).




🎯 Goal




Deliver a professional, modern HRGA attendance system that ensures accuracy, efficiency, and transparency in employee presence tracking, fully aligned with PT. Kemika Karya Pratama’s operational standards.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kemikaattendance.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0867238-6dd1-4ca2-aca6-5168a1774a7a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `HRKemika` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
