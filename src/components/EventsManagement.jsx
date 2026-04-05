import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, CheckCircle, XCircle, UserX } from 'lucide-react';
import { addEvent, getAllEvents, deleteEvent, markRemainingStudentsAbsent } from '../db/hybridDatabase';
import { formatTime12Hour } from '../utils/timeFormatter';

export default function EventsManagement({ onEventSelect }) {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    lateThreshold: '',
    endTime: '',
    fineAmount: '',
    description: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadEvents = async () => {
    try {
      const allEvents = await getAllEvents();
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Event name is required');
      return;
    }

    setIsAdding(true);
    setError(null);
    setResult(null);

    try {
      await addEvent(formData);
      
      setResult({
        success: true,
        message: `Event "${formData.name}" created successfully`
      });
      
      // Reset form
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        lateThreshold: '',
        endTime: '',
        fineAmount: '',
        description: ''
      });
      setShowForm(false);
      
      // Reload events
      await loadEvents();
      
      // Clear success message after 3 seconds
      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete event "${name}"? This will not delete attendance records.`)) {
      return;
    }

    try {
      await deleteEvent(id);
      setResult({
        success: true,
        message: `Event "${name}" deleted`
      });
      await loadEvents();
      
      // Clear success message after 3 seconds
      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    if (onEventSelect) {
      onEventSelect(eventId);
    }
  };

  const handleMarkAbsent = async (event) => {
    // Check if event has ended
    const now = new Date();
    const eventDateTime = new Date(`${event.date}T${event.endTime || '23:59'}`);
    
    if (now < eventDateTime) {
      if (!confirm(`The event "${event.name}" hasn't ended yet (ends at ${event.endTime || 'end of day'}). Mark remaining students as absent anyway?`)) {
        return;
      }
    } else {
      if (!confirm(`Mark all students who haven't scanned as ABSENT for "${event.name}"?`)) {
        return;
      }
    }

    try {
      const result = await markRemainingStudentsAbsent(event.id);
      setResult({
        success: true,
        message: `Marked ${result.markedCount} student(s) as absent for "${result.eventName}"`
      });
      
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          Events Management
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 w-full sm:w-auto justify-center text-sm sm:text-base"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'Create Event'}
        </button>
      </div>

      {/* Success Message */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Success!</h3>
              <p className="text-green-700 mt-1">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Create New Event</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Event Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Weekly Meeting, Seminar, Training"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isAdding}
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isAdding}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Start Time (Optional)
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isAdding}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Late After (Optional)
                </label>
                <input
                  type="time"
                  value={formData.lateThreshold}
                  onChange={(e) => setFormData({...formData, lateThreshold: e.target.value})}
                  className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  disabled={isAdding}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                End Time (Optional)
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isAdding}
              />
            </div>
            <p className="text-xs text-gray-500">
              💡 Set time window to restrict when attendance can be recorded. Late arrivals pay 75% of absent fine.
            </p>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Absent Fine Amount (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">₱</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fineAmount}
                  onChange={(e) => setFormData({...formData, fineAmount: e.target.value})}
                  placeholder="Leave empty to use default from Settings"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isAdding}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Set custom fine amount for this event to encourage attendance at important events
              </p>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Event details, location, or notes..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isAdding}
              />
            </div>
            <button
              type="submit"
              disabled={isAdding}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isAdding ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">All Events ({events.length})</h3>
        
        {events.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 sm:p-8 text-center">
            <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm sm:text-base">No events created yet</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Click "Create Event" to add your first event</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className={`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors ${
                  selectedEventId === event.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => handleSelectEvent(event.id)}>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{event.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      📅 {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    {(event.startTime || event.lateThreshold || event.endTime) && (
                      <p className="text-xs sm:text-sm text-blue-600 mt-1">
                        🕐 {formatTime12Hour(event.startTime)}
                        {event.lateThreshold && <span className="text-yellow-600"> → Late: {formatTime12Hour(event.lateThreshold)}</span>}
                        {' '} to {formatTime12Hour(event.endTime)}
                      </p>
                    )}
                    {event.fineAmount && event.fineAmount > 0 && (
                      <p className="text-xs sm:text-sm text-red-600 mt-1 font-semibold">
                        💰 Absent Fine: ₱{parseFloat(event.fineAmount).toFixed(2)}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">{event.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      onClick={() => handleMarkAbsent(event)}
                      className="text-orange-600 hover:text-orange-700 p-1.5 sm:p-2"
                      title="Mark remaining students as absent"
                    >
                      <UserX className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id, event.name)}
                      className="text-red-600 hover:text-red-700 p-1.5 sm:p-2"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
                {selectedEventId === event.id && (
                  <div className="mt-2 text-xs sm:text-sm text-blue-600 font-medium">
                    ✓ Selected for attendance tracking
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
