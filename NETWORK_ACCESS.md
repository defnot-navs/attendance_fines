# Network Access Guide

## Accessing from Third-Party Phones & Devices

The system is now configured to be accessible from any device on the same network (WiFi/LAN).

### Current Network URLs:

#### Main Admin Dashboard
```
http://192.168.1.8:5173/admin
```
Full access to all management features

#### 📱 Mobile QR Scanner (Recommended for third-party phones)
```
http://192.168.1.8:5173/scan
```
**Best for:** Security personnel, volunteers, or third-party users who only need QR scanning access
- ✅ Direct access to QR scanner only (no admin functions)
- ✅ Mobile-optimized interface
- ✅ Easy back button to admin
- ✅ Perfect for dedicated scanning devices

#### Student View
```
http://192.168.1.8:5173/student
```
For students to check their attendance and fines

#### Local Access (this computer)
```
http://localhost:5173/
```

### How to Access from Your Phone:

1. **Connect to the Same WiFi Network**
   - Ensure your phone is connected to the same WiFi network as your computer
   
2. **Open Your Phone's Browser**
   - Use Chrome, Safari, Firefox, or any modern browser
   
3. **Enter the Network URL**
   - For QR scanning: `http://192.168.1.8:5173/scan`
   - For full admin: `http://192.168.1.8:5173/admin`
   
4. **Add to Home Screen (Optional)**
   - On iOS: Tap Share → Add to Home Screen
   - On Android: Tap Menu → Add to Home Screen
   - This creates an app-like experience

### Features Available on Mobile:

✅ **QR Code Scanner** - Uses your phone's camera  
✅ **Manual Entry** - Enter student IDs manually  
✅ **Upload QR Images** - Take photos of QR codes  
✅ **Offline Support** - Works without internet (uses IndexedDB)  
✅ **All Management Features** - Full access to students, events, fines, etc.

### Troubleshooting:

**Camera Won't Start on Phone?**
1. **Close other camera apps** - Camera can only be used by one app at a time
2. **Refresh the page** - Press F5 or pull down to refresh
3. **Check browser permissions** - Go to browser settings → Site settings → Camera
4. **Use Chrome or Safari** - These browsers have better camera support
5. **Try the "Upload QR Code Image" option** - Take a photo and upload it instead
6. **Clear browser cache** - Go to browser settings → Clear browsing data
7. **Use HTTPS** - Some phones require secure connection for camera (see below)

**HTTPS for Camera Access (Advanced):**
Some mobile browsers require HTTPS for camera access. If camera doesn't work over HTTP:
1. Use the "Upload QR Code Image" feature instead (works without camera)
2. Or use localhost for testing (camera works on localhost)
3. For production, deploy with HTTPS (use Cloudflare, Netlify, or Vercel)

**Cannot Access from Phone?**
1. Check both devices are on the same WiFi
2. Disable VPN on phone if active
3. Check Windows Firewall settings (allow port 5173)
4. Try restarting the dev server: `npm run dev`

**Get Your Current Network IP:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Allow Through Windows Firewall:**
```powershell
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

### Notes:
- The network IP (192.168.1.8) may change if you reconnect to WiFi
- All data is stored locally on each device's browser
- For production deployment, use a proper web server

### QR Code for Quick Access:
Use any QR code generator with the URL: `http://192.168.1.8:5173/`
