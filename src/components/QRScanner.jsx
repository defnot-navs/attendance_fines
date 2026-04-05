import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { parseQRCode } from '../utils/qrParser';
import { getStudentByStudentId, recordAttendance, getAllEvents } from '../db/hybridDatabase';
import { autoGenerateFines } from '../utils/finesCalculator';
import { formatTime12Hour } from '../utils/timeFormatter';
import { CheckCircle, XCircle, Camera, Upload, Calendar, Smartphone, Copy } from 'lucide-react';

export default function QRScanner({ selectedEventId }) {
  const [scanner, setScanner] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [manualStudentId, setManualStudentId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [events, setEvents] = useState([]);
  const [localSelectedEventId, setLocalSelectedEventId] = useState(selectedEventId);
  const [copied, setCopied] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState('AM_IN');

  const getSessionLabel = (session) => {
    switch (session) {
      case 'AM_IN':
        return 'AM-IN';
      case 'AM_OUT':
        return 'AM-OUT';
      case 'PM_IN':
        return 'PM-IN';
      case 'PM_OUT':
        return 'PM-OUT';
      default:
        return session || 'AM-IN';
    }
  };

  const processingRef = useRef(false);
  const lastScanRef = useRef({ text: null, at: 0 });

  const mobileUrl = `http://${window.location.hostname}:${window.location.port}/scan`;

  const copyMobileUrl = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setLocalSelectedEventId(selectedEventId);
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const allEvents = await getAllEvents();
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanner]);

  const startScanning = async () => {
    setResult(null);
    setError(null);
    setIsScanning(true);

    // Wait for DOM to update
    setTimeout(async () => {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHttps = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isHttps && !isLocalhost) {
          setError('⚠️ Camera requires HTTPS. For IP access, use "Upload QR Image" instead or access via localhost on this device.');
          setIsScanning(false);
          return;
        }
        
        setError('Camera not supported on this browser. Please use Chrome, Firefox, or Safari. Try "Upload QR Image" as alternative.');
        setIsScanning(false);
        return;
      }

      // Check camera permissions with better mobile support
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Camera permission error:', err);
        let errorMessage = 'Camera access denied. ';
        
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera permissions in your browser settings.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          errorMessage += 'Camera is already in use by another app. Please close other camera apps.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage += 'Camera does not meet requirements. Trying alternative...';
        } else if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
          errorMessage = '⚠️ Camera requires HTTPS on this device. Use "Upload QR Image" instead.';
        } else {
          errorMessage += `Error: ${err.message}`;
        }
        
        setError(errorMessage);
        setIsScanning(false);
        return;
      }

      try {
        const isMobile = window.innerWidth < 640;
        
        const config = {
          fps: isMobile ? 10 : 30, // Lower FPS on mobile for better performance
          // Use a LARGE scan region so users don't need perfect alignment.
          // This keeps a visible box but covers most of the camera frame.
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.9);
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          // Additional mobile-friendly options
          supportedScanTypes: [],
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        };
        
        const html5QrcodeScanner = new Html5QrcodeScanner(
          "qr-reader",
          config,
          false
        );

        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        setScanner(html5QrcodeScanner);
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setError(`Failed to initialize scanner: ${err.message || 'Unknown error'}. Try using the image upload feature instead.`);
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setIsScanning(false);
  };

  const onScanSuccess = async (decodedText) => {
    const now = Date.now();
    // Throttle repeated callbacks (camera can fire success multiple times per second)
    if (processingRef.current) return;
    if (lastScanRef.current.text === decodedText && now - lastScanRef.current.at < 2000) return;
    lastScanRef.current = { text: decodedText, at: now };

    processingRef.current = true;
    try {
      await processQRCode(decodedText);
    } finally {
      processingRef.current = false;
    }
  };

  const onScanFailure = (error) => {
    // Ignore scan failures (happens frequently during scanning)
    // Intentionally no-op to avoid noisy logs.
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (!manualStudentId.trim()) {
      setError('Please enter a Student ID');
      return;
    }

    let attendanceStatus = 'present';
    let isLate = false;
    let selectedEvent = null;
    
    // Check if time window is valid for selected event
    if (localSelectedEventId) {
      selectedEvent = events.find(e => e.id === localSelectedEventId);
      if (selectedEvent && (selectedEvent.startTime || selectedEvent.endTime)) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
        
        if (selectedEvent.startTime && currentTime < selectedEvent.startTime) {
          setError(`Attendance recording starts at ${formatTime12Hour(selectedEvent.startTime)}. Current time: ${formatTime12Hour(currentTime)}`);
          return;
        }
        
        if (selectedEvent.endTime && currentTime > selectedEvent.endTime) {
          setError(`Attendance recording ended at ${formatTime12Hour(selectedEvent.endTime)}. Current time: ${formatTime12Hour(currentTime)}`);
          return;
        }
        
        // If scan happens during the configured "late" window, treat it as ABSENT
        if (selectedEvent.lateThreshold && currentTime >= selectedEvent.lateThreshold) {
          attendanceStatus = 'absent';
          isLate = true;
        }
      }
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Check if student exists
      const student = await getStudentByStudentId(manualStudentId.trim());

      if (!student) {
        setError(`Student ID ${manualStudentId.trim()} not found in database`);
        setIsProcessing(false);
        return;
      }

      // Record attendance
      try {
        await recordAttendance(manualStudentId.trim(), 'manual', attendanceStatus, localSelectedEventId, attendanceSession);
        
        // Auto-generate absent fine if applicable
        if (isLate) {
          await autoGenerateFines(
            manualStudentId.trim(),
            localSelectedEventId,
            'absent',
            selectedEvent
              ? { date: selectedEvent.date, fineAmount: selectedEvent.fineAmount, name: selectedEvent.name }
              : null
          );
        }
        
        setResult({
          success: true,
          student,
          message: `Attendance recorded successfully (Manual Entry)${localSelectedEventId ? ' for selected event' : ''}`,
          isLate: isLate
        });
        setError(null);
        setManualStudentId(''); // Clear input
      } catch (err) {
        if (err.message.includes('already recorded')) {
          const modeLabel = getSessionLabel(attendanceSession);
          setError(`Attendance already recorded (${modeLabel}) for ${student.firstName} ${student.lastName}`);
        } else {
          setError(err.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    setError(null);
    setResult(null);

    try {
      const html5QrCode = new Html5Qrcode("qr-image-reader");
      const decodedText = await html5QrCode.scanFile(file, false);
      
      // Process the scanned QR code
      await processQRCode(decodedText);
      
    } catch (err) {
      setError(`Failed to scan QR code from image: ${err.message || 'Please ensure the image contains a clear QR code'}`);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const processQRCode = async (decodedText) => {
    try {
      let attendanceStatus = 'present';
      let isLate = false;
      let selectedEvent = null;
      
      // Check if time window is valid for selected event
      if (localSelectedEventId) {
        selectedEvent = events.find(e => e.id === localSelectedEventId);
        if (selectedEvent && (selectedEvent.startTime || selectedEvent.endTime)) {
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
          
          if (selectedEvent.startTime && currentTime < selectedEvent.startTime) {
            setError(`Attendance recording starts at ${formatTime12Hour(selectedEvent.startTime)}. Current time: ${formatTime12Hour(currentTime)}`);
            setResult(null);
            return;
          }
          
          if (selectedEvent.endTime && currentTime > selectedEvent.endTime) {
            setError(`Attendance recording ended at ${formatTime12Hour(selectedEvent.endTime)}. Current time: ${formatTime12Hour(currentTime)}`);
            setResult(null);
            return;
          }
          
          // If scan happens during the configured "late" window, treat it as ABSENT
          if (selectedEvent.lateThreshold && currentTime >= selectedEvent.lateThreshold) {
            attendanceStatus = 'absent';
            isLate = true;
          }
        }
      }

      // Parse QR code to extract Student ID
      const studentId = parseQRCode(decodedText);

      // Check if student exists
      const student = await getStudentByStudentId(studentId);

      if (!student) {
        setError(`Student ID ${studentId} not found in database`);
        setResult(null);
        return;
      }

      // Record attendance
      try {
        await recordAttendance(studentId, 'qr', attendanceStatus, localSelectedEventId, attendanceSession);
        
        // Auto-generate absent fine if applicable
        if (isLate) {
          await autoGenerateFines(
            studentId,
            localSelectedEventId,
            'absent',
            selectedEvent
              ? { date: selectedEvent.date, fineAmount: selectedEvent.fineAmount, name: selectedEvent.name }
              : null
          );
        }
        
        setResult({
          success: true,
          student,
          message: `Attendance recorded successfully${localSelectedEventId ? ' for selected event' : ''}`,
          isLate: isLate
        });
        setError(null);
      } catch (err) {
        if (err.message.includes('already recorded')) {
          const modeLabel = getSessionLabel(attendanceSession);
          setError(`Attendance already recorded (${modeLabel}) for ${student.firstName} ${student.lastName}`);
        } else {
          setError(err.message);
        }
        setResult(null);
      }
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      {/* Mobile Scanner Access Card */}
      {window.location.hostname !== 'localhost' && !window.location.pathname.includes('/scan') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-blue-900">📱 Third-Party Phone Access</p>
              <p className="text-xs text-blue-700 mt-1">
                For convenience, share this direct scanner link with security or volunteers:
              </p>
              <div className="flex items-center gap-2 mt-2 bg-white rounded px-2 sm:px-3 py-2 border border-blue-200">
                <code className="text-xs flex-1 text-blue-800 break-all">{mobileUrl}</code>
                <button
                  onClick={copyMobileUrl}
                  className="text-blue-600 hover:text-blue-700 flex-shrink-0 p-1 touch-manipulation"
                  title="Copy URL"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                ✓ Direct scanner access • No admin navigation needed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Camera Requirements Notice for Mobile */}
      {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <Camera className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm text-yellow-800 font-semibold">Camera Access Limited</p>
              <p className="text-xs text-yellow-700 mt-1">
                Some browsers require HTTPS for camera access. If camera doesn't work, use the "Upload QR Code Image" option below.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          QR Code Scanner
        </h2>
        {!isScanning ? (
          <button
            onClick={startScanning}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm sm:text-base font-medium w-full sm:w-auto touch-manipulation"
          >
            Start Scanning
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="bg-red-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-red-700 active:bg-red-800 text-sm sm:text-base font-medium w-full sm:w-auto touch-manipulation"
          >
            Stop Scanning
          </button>
        )}
      </div>

      {/* Event Selection Dropdown */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-semibold text-blue-900 mb-1">
                Attendance Mode
              </label>
              <select
                value={attendanceSession}
                onChange={(e) => setAttendanceSession(e.target.value)}
                className="w-full sm:w-56 border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="AM_IN">AM - IN</option>
                <option value="AM_OUT">AM - OUT</option>
                <option value="PM_IN">PM - IN</option>
                <option value="PM_OUT">PM - OUT</option>
              </select>
              <p className="text-xs text-blue-700 mt-1">
                One scan per student per mode per day.
              </p>
            </div>
            <label className="block text-xs sm:text-sm font-medium text-blue-900 mb-2">
              Select Event (Optional)
            </label>
            <select
              value={localSelectedEventId || ''}
              onChange={(e) => setLocalSelectedEventId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm sm:text-base touch-manipulation"
            >
              <option value="">No event - Record by date only</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.date).toLocaleDateString()}
                  {event.startTime && event.endTime ? ` (${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)})` : ''}
                </option>
              ))}
            </select>
            {events.length === 0 && (
              <p className="text-xs sm:text-sm text-blue-600 mt-2">
                No events created yet. Go to Events tab to create one.
              </p>
            )}
            {localSelectedEventId && (
              <p className="text-xs sm:text-sm text-blue-700 mt-2">
                ✓ Attendance will be recorded for the selected event
                {(() => {
                  const event = events.find(e => e.id === localSelectedEventId);
                  if (event && (event.startTime || event.endTime)) {
                    return ` (${event.startTime || '—'} to ${event.endTime || '—'})`;
                  }
                  return '';
                })()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scanner Container */}
      {isScanning && (
        <div className="mb-4">
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-2 mb-2">
            <p className="text-xs text-gray-600 text-center">
              📸 Position QR code within the box below
            </p>
          </div>
          <div id="qr-reader" className="w-full"></div>
          <div className="mt-2 text-xs text-gray-600">
            <p className="font-semibold mb-1">Camera not starting?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Close other apps using the camera</li>
              <li>Try refreshing the page (F5)</li>
              <li>Check camera permissions in browser settings</li>
              <li>Use the "Upload QR Code Image" option below</li>
            </ul>
          </div>
        </div>
      )}

      {/* Hidden div for image scanning */}
      <div id="qr-image-reader" className="hidden"></div>

      {/* Upload QR Code Image */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
          <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
          Upload QR Code Image
        </h3>
        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploadingImage}
            className="block w-full text-xs sm:text-sm text-gray-500
              file:mr-3 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4
              file:rounded-lg file:border-0
              file:text-xs sm:file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700 active:file:bg-blue-800
              disabled:opacity-50 cursor-pointer touch-manipulation"
          />
          <p className="mt-2 text-xs sm:text-sm text-blue-700">
            {isUploadingImage ? 'Processing image...' : 'Take a photo or upload QR code'}
          </p>
        </label>
      </div>

      {/* Manual Entry Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Manual Entry</h3>
        <form onSubmit={handleManualEntry} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={manualStudentId}
            onChange={(e) => setManualStudentId(e.target.value)}
            placeholder="Enter Student ID (e.g., 2021-12345)"
            className="flex-1 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base touch-manipulation"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="bg-green-600 text-white px-4 sm:px-6 py-2.5 rounded-lg hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base font-medium w-full sm:w-auto touch-manipulation"
          >
            {isProcessing ? 'Processing...' : 'Submit'}
          </button>
        </form>
      </div>

      {/* Success Message */}
      {result && (
        <div className={`border rounded-lg p-3 sm:p-4 mb-4 ${result.isLate ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start gap-2 sm:gap-3">
            <CheckCircle className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 ${result.isLate ? 'text-yellow-600' : 'text-green-600'}`} />
            <div>
              <h3 className={`font-semibold text-sm sm:text-base ${result.isLate ? 'text-yellow-900' : 'text-green-900'}`}>
                {result.isLate ? 'Late Scan - Marked Absent' : 'Success!'}
              </h3>
              <p className={`mt-1 text-sm sm:text-base ${result.isLate ? 'text-yellow-700' : 'text-green-700'}`}>
                {result.student.lastName}, {result.student.firstName} {result.student.middleInitial}
              </p>
              <p className={`text-xs sm:text-sm mt-1 ${result.isLate ? 'text-yellow-600' : 'text-green-600'}`}>
                Student ID: {result.student.studentId}
              </p>
              <p className={`text-xs sm:text-sm ${result.isLate ? 'text-yellow-600' : 'text-green-600'}`}>{result.message}</p>
              {result.isLate && (
                <p className="text-xs sm:text-sm text-yellow-700 font-semibold mt-2">
                  ⚠️ Marked as absent and absent fine applied
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 text-sm sm:text-base">Error</h3>
              <p className="text-red-700 mt-1 text-xs sm:text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isScanning && !result && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
            <li>Click "Start Scanning" to activate the camera</li>
            <li>Position the QR code within the scanning box</li>
            <li>The system will automatically detect and record attendance</li>
            <li>Existing student QR codes are supported</li>
          </ul>
        </div>
      )}
    </div>
  );
}
