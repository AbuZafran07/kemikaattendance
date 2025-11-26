# Firebase Cloud Messaging Setup Guide

## Langkah-langkah Setup FCM:

### 1. Buat Firebase Project
1. Kunjungi [Firebase Console](https://console.firebase.google.com/)
2. Klik "Add project" atau "Tambah project"
3. Ikuti wizard untuk membuat project baru

### 2. Dapatkan Firebase Configuration
1. Di Firebase Console, klik ⚙️ (Settings) > Project settings
2. Scroll ke bawah ke bagian "Your apps"
3. Klik ikon Web (</>) untuk menambahkan web app
4. Daftarkan app Anda dan copy configuration values:
   - API Key
   - Auth Domain
   - Project ID
   - Storage Bucket
   - Messaging Sender ID
   - App ID

### 3. Enable Cloud Messaging
1. Di Firebase Console, buka menu "Cloud Messaging"
2. Klik tab "Web configuration"
3. Generate atau copy VAPID Key (Web Push certificates)

### 4. Tambahkan ke Lovable Project

**PENTING**: Karena ini adalah publishable keys (bukan secret keys), Anda perlu menambahkan mereka ke file `.env` di root project Anda:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

**Catatan**: Firebase Server Key (untuk edge function) sudah tersimpan di Supabase Secrets.

### 5. Update Service Worker

Edit file `public/firebase-messaging-sw.js` dan ganti placeholder values dengan config Firebase Anda:

```javascript
firebase.initializeApp({
  apiKey: "your_api_key",
  authDomain: "your_project_id.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project_id.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id"
});
```

### 6. Test Push Notifications

1. Deploy project Anda
2. Buka aplikasi di browser yang support notifications (Chrome, Firefox, Edge)
3. Allow notification permission saat diminta
4. FCM token akan muncul di browser console

### 7. Kirim Test Notification

Gunakan Firebase Console > Cloud Messaging > "Send your first message" untuk test notification manual.

## Troubleshooting

### "Missing App configuration value: projectId"
- Pastikan semua VITE_FIREBASE_* environment variables sudah diset di file .env
- Restart development server setelah update .env

### "This browser doesn't support the API"
- Push notifications hanya support di browser modern (Chrome, Firefox, Edge)
- Tidak support di Safari versi lama atau browser mobile tertentu

### Token tidak muncul
- Pastikan user sudah allow notification permission
- Cek browser console untuk error messages
- Pastikan VAPID key benar

## Deployment ke Production

Saat deploy ke production (publish di Lovable):
1. Pastikan environment variables sudah diset di project settings Lovable
2. Service worker akan otomatis ter-register
3. Test notifications di production URL

## Sending Notifications from Backend

Gunakan edge function `send-notification` untuk mengirim push notifications:

```typescript
const { data, error } = await supabase.functions.invoke('send-notification', {
  body: {
    fcmToken: 'user_fcm_token',
    title: 'Check-In Berhasil',
    body: 'Anda telah check-in pada 08:00',
    data: { type: 'attendance', id: '123' }
  }
});
```
