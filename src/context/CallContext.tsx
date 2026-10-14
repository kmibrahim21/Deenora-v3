import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { voiceCallService, CallPayload, CallStatus, CallStudentInfo, CallParticipantInfo } from '../services/callService';
import { VoiceCallModal } from '../components/call/VoiceCallModal';
import { VoiceCallPermissionModal } from '../components/call/VoiceCallPermissionModal';

// Helper: safe caller to Android WebView bridge methods
const native = (fn: string) => {
  try {
    (window as any).AndroidInterface?.[fn]?.();
  } catch {}
};

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
  rejectCall: (reason?: string, specificCallId?: string) => void;
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
  const [pendingCallRequest, setPendingCallRequest] = useState<{
    student: CallStudentInfo;
    caller?: CallParticipantInfo;
    institutionId?: string;
  } | null>(null);
  const autoAnswerRef = useRef<string | null>(null);
  const isFirstStatusRender = useRef<boolean>(true);
  const handledUrlRef = useRef<string>('');

  // Task 3b: Native Android bridge sync on callStatus transitions
  useEffect(() => {
    if (isFirstStatusRender.current) {
      isFirstStatusRender.current = false;
      return;
    }
    if (callStatus === 'connected') {
      native('callStarted');
    } else if (callStatus === 'ended' || callStatus === 'rejected' || callStatus === 'busy' || callStatus === 'failed' || callStatus === 'idle') {
      native('stopRinging');
      native('callEnded');
    }
  }, [callStatus]);

  // Initialize service listeners once
  useEffect(() => {
    voiceCallService.onStatusChange = (status, data) => {
      setCallStatus(status);
      if (data) {
        setActiveCall(data);
      }
      if (status === 'connected') {
        setDuration(0);
      } else if (status === 'busy') {
        setTimeout(() => {
          setCallStatus('idle');
          setActiveCall(null);
          setDuration(0);
          setIsMuted(false);
          setIsSpeakerOn(true);
        }, 3200);
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
      const hasBridge = typeof window !== 'undefined' && Boolean((window as any).AndroidInterface?.onIncomingCall);
      if (!hasBridge) {
        setCallStatus('incoming');
      }
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
    const hasBridge = typeof window !== 'undefined' && Boolean((window as any).AndroidInterface?.onIncomingCall);
    // Check if there is an active incoming call already in memory or localStorage
    const existingCall = voiceCallService.getActiveCall();
    if (existingCall && callStatus === 'idle' && !hasBridge) {
      setActiveCall(existingCall);
      setCallStatus('incoming');
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('deenora_call_events');
      bc.onmessage = (event) => {
        if (event.data?.type === 'INCOMING_CALL' && event.data.payload) {
          setActiveCall(event.data.payload);
          setIsCaller(false);
          if (!hasBridge) {
            setCallStatus('incoming');
          }
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
        native('stopRinging');
        const currentActive = activeCall || voiceCallService.getActiveCall();
        if (currentActive) {
          setActiveCall(currentActive);
          setCallStatus('connected');
        }
        await voiceCallService.acceptCall();
      } else if (event.data.type === 'REJECT_CALL_FROM_NOTIFICATION') {
        console.log('[CallContext] Received REJECT_CALL_FROM_NOTIFICATION from SW');
        native('stopRinging');
        voiceCallService.rejectCall('মোবাইলের নোটিফিকেশন থেকে কল বাতিল করা হয়েছে।');
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [activeCall]);

  // Listen for Android Native Bridge (MainActivity.kt / CallService.kt -> window.handleNativeCallAction)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAction = async (action: string, callId?: string) => {
      console.log('[CallContext] Received handleNativeCallAction from Android Native:', action, callId);
      const cleanAction = String(action || '').toLowerCase().trim();

      if (cleanAction === 'accept_call' || cleanAction === 'answer' || cleanAction === 'accept') {
        native('stopRinging');
        const currentActive = activeCall || voiceCallService.getActiveCall();
        if (currentActive && (!callId || currentActive.callId === callId)) {
          setActiveCall(currentActive);
          setCallStatus('connected');
        } else if (callId) {
          autoAnswerRef.current = callId;
        }
        await voiceCallService.handleNativeAction('answer', callId);
      } else if (cleanAction === 'reject_call' || cleanAction === 'decline' || cleanAction === 'reject') {
        native('stopRinging');
        autoAnswerRef.current = null;
        await voiceCallService.handleNativeAction('decline', callId);
        setCallStatus('idle');
        setActiveCall(null);
      } else if (cleanAction === 'end_call' || cleanAction === 'hangup' || cleanAction === 'end') {
        native('stopRinging');
        autoAnswerRef.current = null;
        await voiceCallService.handleNativeAction('end', callId);
        setCallStatus('idle');
        setActiveCall(null);
      }
    };

    (window as any).handleNativeCallAction = handleAction;
    (window as any).onNativeCallAction = handleAction;

    (window as any).setDeviceFcmToken = async (token: string, phone?: string) => {
      console.log('[CallContext] Received setDeviceFcmToken from Android:', token ? `${token.substring(0, 15)}...` : '');
      if (!token) return;
      try {
        localStorage.setItem('deenora_fcm_token', token);
        const resolvedPhone = phone || (activeCall?.calleePhone) || (typeof window !== 'undefined' ? localStorage.getItem('parent_phone') : null);
        await fetch('/api/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_token',
            token,
            phone: resolvedPhone || undefined,
          }),
        });
      } catch (err) {
        console.warn('[CallContext] register_token error:', err);
      }
    };

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).handleNativeCallAction = (act: string, cId?: string) => voiceCallService.handleNativeAction(act, cId);
        (window as any).onNativeCallAction = (window as any).handleNativeCallAction;
      }
    };
  }, [activeCall]);

  // Auto-answer or open call screen if user unlocked phone / opened app directly from lock screen notification, FCM tap, or URL query (?answer=1&call_id=xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    if (!search || handledUrlRef.current === search) return;

    const params = new URLSearchParams(search);
    const isFcmTap = params.get('fcm_tap') === '1';
    const answerVal = params.get('answer');
    const targetCallId = params.get('call_id');
    let action = params.get('action');

    if (!action) {
      if (answerVal === '1') {
        action = 'accept_call';
      } else if (answerVal === '0') {
        action = 'reject_call';
      } else if (isFcmTap) {
        action = 'incoming_call';
      }
    }

    if (!action && !answerVal && !isFcmTap) return;
    handledUrlRef.current = search;

    if (action === 'reject_call' || answerVal === '0') {
      native('stopRinging');
      voiceCallService.rejectCall('অভিভাবক কল কেটে দিয়েছেন।', targetCallId || undefined, true);
      const url = new URL(window.location.href);
      ['fcm_tap', 'answer', 'caller_name', 'call_id', 'action', 't'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      return;
    }

    if (action === 'accept_call' || action === 'incoming_call') {
      const pendingCall = activeCall || voiceCallService.getActiveCall();
      if (pendingCall && (!targetCallId || pendingCall.callId === targetCallId)) {
        setActiveCall(pendingCall);
        if (action === 'accept_call') {
          console.log('[CallContext] Auto-answering call from URL parameter (?answer=1):', pendingCall.callId);
          native('stopRinging');
          setCallStatus('connected');
          voiceCallService.acceptCall();
        } else {
          const hasBridge = typeof window !== 'undefined' && Boolean((window as any).AndroidInterface?.onIncomingCall);
          if (!hasBridge) {
            setCallStatus('incoming');
          }
        }

        // Clean query parameter from URL without reload
        const url = new URL(window.location.href);
        ['fcm_tap', 'answer', 'caller_name', 'call_id', 'action', 't'].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      } else if (targetCallId) {
        // App was closed / fresh start case:
        if (action === 'accept_call') {
          console.log('[CallContext] Fresh start with ?answer=1&call_id=' + targetCallId + '. Staging auto-answer...');
          autoAnswerRef.current = targetCallId;
          voiceCallService.setPendingAutoAnswer(targetCallId);
        }
        native('stopRinging');
        voiceCallService.subscribeCallRoom(targetCallId);
        voiceCallService.requestOffer(targetCallId);

        // Clean query parameter from URL without reload
        const url = new URL(window.location.href);
        ['fcm_tap', 'answer', 'caller_name', 'call_id', 'action', 't'].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      }
    }
  }, [activeCall, callStatus]);

  // Auto-answer when incoming call arrives if user tapped answer on native lockscreen/FCM notification or URL
  useEffect(() => {
    if (callStatus === 'incoming' && activeCall?.callId && (autoAnswerRef.current === activeCall.callId || autoAnswerRef.current === '__ANY__')) {
      console.log('[CallContext] Auto-answering incoming call matching autoAnswerRef:', activeCall.callId);
      autoAnswerRef.current = null;
      native('stopRinging');
      setCallStatus('connected');
      voiceCallService.acceptCall();
    }
  }, [callStatus, activeCall]);

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

  const executeStartCall = useCallback(
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

  const startCall = useCallback(
    async (student: CallStudentInfo, caller?: CallParticipantInfo, institutionId?: string): Promise<boolean> => {
      // Check if permission was already granted previously in this session/browser
      const alreadyGranted = typeof window !== 'undefined' && localStorage.getItem('deenora_call_permission_granted') === 'true';

      // Check browser permissions query if supported
      let needsPrompt = !alreadyGranted;
      if (typeof navigator !== 'undefined' && (navigator as any).permissions && (navigator as any).permissions.query) {
        try {
          const micStatus = await (navigator as any).permissions.query({ name: 'microphone' });
          if (micStatus.state === 'granted') {
            needsPrompt = false;
          }
        } catch {}
      }

      if (needsPrompt) {
        // Show polished pre-call permission modal
        setPendingCallRequest({ student, caller, institutionId });
        return true;
      }

      return await executeStartCall(student, caller, institutionId);
    },
    [executeStartCall]
  );

  const handlePermissionGranted = useCallback(async () => {
    if (!pendingCallRequest) return;
    const { student, caller, institutionId } = pendingCallRequest;
    setPendingCallRequest(null);
    await executeStartCall(student, caller, institutionId);
  }, [pendingCallRequest, executeStartCall]);

  const handlePermissionCancel = useCallback(() => {
    setPendingCallRequest(null);
  }, []);

  const acceptCall = useCallback(async () => {
    native('stopRinging');
    return await voiceCallService.acceptCall();
  }, []);

  const rejectCall = useCallback(async (reason?: string, specificCallId?: string) => {
    native('stopRinging');
    await voiceCallService.rejectCall(reason, specificCallId);
  }, []);

  const endCall = useCallback(async () => {
    await voiceCallService.endCall();
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
      <VoiceCallPermissionModal
        isOpen={!!pendingCallRequest}
        calleeName={pendingCallRequest?.student?.guardian_name || pendingCallRequest?.student?.name}
        onGrant={handlePermissionGranted}
        onCancel={handlePermissionCancel}
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
