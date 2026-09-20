import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { voiceCallService, CallPayload, CallStatus, CallStudentInfo, CallParticipantInfo } from '../services/callService';
import { VoiceCallModal } from '../components/call/VoiceCallModal';

interface CallContextType {
  callStatus: CallStatus;
  activeCall: CallPayload | null;
  isCaller: boolean;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  initSignaling: (institutionId: string, userId: string, phone?: string) => void;
  startCall: (student: CallStudentInfo, caller?: CallParticipantInfo, institutionId?: string) => Promise<boolean>;
  acceptCall: () => Promise<boolean>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = useState<CallPayload | null>(null);
  const [isCaller, setIsCaller] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);

  // Initialize service listeners once
  useEffect(() => {
    voiceCallService.onStatusChange = (status, data) => {
      setCallStatus(status);
      if (data) {
        setActiveCall(data);
      }
      if (status === 'connected') {
        setDuration(0);
      } else if (status === 'idle' || status === 'ended' || status === 'rejected' || status === 'failed') {
        setTimeout(() => {
          setCallStatus('idle');
          setActiveCall(null);
          setDuration(0);
          setIsMuted(false);
          setIsSpeakerOn(true);
        }, 1200);
      }
    };

    voiceCallService.onIncomingCall = (call) => {
      setActiveCall(call);
      setIsCaller(false);
      setCallStatus('incoming');
    };

    voiceCallService.onError = (msg) => {
      console.warn('[CallContext] Voice Call Notice:', msg);
    };

    return () => {
      voiceCallService.destroy();
    };
  }, []);

  // Listen for Service Worker incoming call actions & cross-tab events
  useEffect(() => {
    // Check if there is an active incoming call already in memory or localStorage
    const existingCall = voiceCallService.getActiveCall();
    if (existingCall && callStatus === 'idle') {
      setActiveCall(existingCall);
      setCallStatus('incoming');
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('deenora_call_events');
      bc.onmessage = (event) => {
        if (event.data?.type === 'INCOMING_CALL' && event.data.payload) {
          setActiveCall(event.data.payload);
          setIsCaller(false);
          setCallStatus('incoming');
        }
      };
      return () => {
        bc.close();
      };
    }
  }, []);

  // Listen for Service Worker incoming call actions (Tap "📞 রিসিভ করুন" or "❌ কেটে দিন" on mobile screen / lock screen)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = async (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'ACCEPT_CALL_FROM_NOTIFICATION') {
        console.log('[CallContext] Received ACCEPT_CALL_FROM_NOTIFICATION from SW');
        const currentActive = activeCall || voiceCallService.getActiveCall();
        if (currentActive) {
          setActiveCall(currentActive);
          setCallStatus('connected');
        }
        await voiceCallService.acceptCall();
      } else if (event.data.type === 'REJECT_CALL_FROM_NOTIFICATION') {
        console.log('[CallContext] Received REJECT_CALL_FROM_NOTIFICATION from SW');
        voiceCallService.rejectCall('মোবাইলের নোটিফিকেশন থেকে কল বাতিল করা হয়েছে।');
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [activeCall]);

  // Auto-answer or open call screen if user unlocked phone / opened app directly from lock screen notification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const targetCallId = params.get('call_id');

    if (action === 'accept_call' || action === 'incoming_call') {
      const pendingCall = activeCall || voiceCallService.getActiveCall();
      if (pendingCall && (!targetCallId || pendingCall.callId === targetCallId)) {
        setActiveCall(pendingCall);
        if (action === 'accept_call') {
          console.log('[CallContext] Auto-answering call from URL parameter');
          setCallStatus('connected');
          voiceCallService.acceptCall();
        } else {
          setCallStatus('incoming');
        }

        // Clean query parameter from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('call_id');
        url.searchParams.delete('t');
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      }
    }
  }, [activeCall, callStatus]);

  // Duration timer during connected call
  useEffect(() => {
    let timer: any = null;
    if (callStatus === 'connected') {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  const initSignaling = useCallback((institutionId: string, userId: string, phone?: string) => {
    if (institutionId || userId || phone) {
      voiceCallService.initSignaling(institutionId, userId, phone);
    }
  }, []);

  const startCall = useCallback(
    async (student: CallStudentInfo, caller?: CallParticipantInfo, institutionId?: string) => {
      const activeInstId = institutionId || activeCall?.institutionId || '';
      const activeCaller = caller || {
        id: 'user-caller',
        name: 'শিক্ষক / এডমিন',
        role: 'teacher',
      };

      setIsCaller(true);
      return await voiceCallService.startCall(student, activeCaller, activeInstId);
    },
    [activeCall]
  );

  const acceptCall = useCallback(async () => {
    return await voiceCallService.acceptCall();
  }, []);

  const rejectCall = useCallback((reason?: string) => {
    voiceCallService.rejectCall(reason);
  }, []);

  const endCall = useCallback(() => {
    voiceCallService.endCall();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      voiceCallService.setMuted(next);
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      voiceCallService.setSpeaker(next);
      return next;
    });
  }, []);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        activeCall,
        isCaller,
        duration,
        isMuted,
        isSpeakerOn,
        initSignaling,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
      }}
    >
      {children}
      <VoiceCallModal
        status={callStatus}
        callData={activeCall}
        isCaller={isCaller}
        duration={duration}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </CallContext.Provider>
  );
};

export const useVoiceCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useVoiceCall must be used within a CallProvider');
  }
  return context;
};
