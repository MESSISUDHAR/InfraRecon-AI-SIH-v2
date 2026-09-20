import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getExecutionEvent } from '../services/api';

const EventContext = createContext(null);

export function EventProvider({ children }) {
  const [activeEventId, setActiveEventIdState] = useState(() => {
    return sessionStorage.getItem('infra_active_event_id') || null;
  });
  const [activeEvent, setActiveEvent] = useState(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);

  // Sync activeEventId with sessionStorage
  const setActiveEventId = useCallback((id) => {
    setActiveEventIdState(id);
    if (id) {
      sessionStorage.setItem('infra_active_event_id', id);
    } else {
      sessionStorage.removeItem('infra_active_event_id');
      setActiveEvent(null);
    }
  }, []);

  // Fetch full event details whenever activeEventId changes
  const refreshActiveEvent = useCallback(async (eventIdOverride = null) => {
    const targetId = eventIdOverride || activeEventId;
    if (!targetId) {
      setActiveEvent(null);
      return null;
    }

    setIsLoadingEvent(true);
    try {
      const eventData = await getExecutionEvent(targetId);
      if (eventData) {
        setActiveEvent(eventData);
        return eventData;
      }
    } catch (err) {
      console.warn(`Could not load active ExecutionEvent ${targetId}:`, err);
    } finally {
      setIsLoadingEvent(false);
    }
    return null;
  }, [activeEventId]);

  useEffect(() => {
    if (activeEventId) {
      refreshActiveEvent(activeEventId);
    }
  }, [activeEventId, refreshActiveEvent]);

  const setFullActiveEvent = useCallback((eventObj) => {
    if (eventObj && eventObj.id) {
      setActiveEvent(eventObj);
      setActiveEventIdState(eventObj.id);
      sessionStorage.setItem('infra_active_event_id', eventObj.id);
    }
  }, []);

  const clearActiveEvent = useCallback(() => {
    setActiveEventIdState(null);
    setActiveEvent(null);
    sessionStorage.removeItem('infra_active_event_id');
  }, []);

  const value = {
    activeEventId,
    activeEvent,
    isLoadingEvent,
    setActiveEventId,
    setActiveEvent: setFullActiveEvent,
    clearActiveEvent,
    refreshActiveEvent
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export function useActiveEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useActiveEvent must be used within an EventProvider');
  }
  return context;
}

export default EventContext;
