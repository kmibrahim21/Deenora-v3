import { supabase } from '../supabase';
import { callSoundService } from './callSoundService';
import { showIncomingCallNotification, dismissIncomingCallNotification } from '../lib/pushNotifications';

export interface CallParticipantInfo {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  institutionName?: string;
}

export interface CallStudentInfo {
  id: string;
  name: string;
  roll?: string | number;
  photo_url?: string;
  class_name?: string;
  guardian_name?: string;
  guardian_phone?: string;
}

export interface CallPayload {
  callId: string;
  institutionId: string;
  institutionName?: string;
  caller: CallParticipantInfo;
  calleePhone?: string;
  student: CallStudentInfo;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  senderId?: string;
  timestamp: number;
}

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended' | 'rejected' | 'failed';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};



export class VoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private channel: any = null;
  private directChannel: any = null;
  private phoneChannel: any = null;
  private currentInstitutionId: string = '';
  private currentUserId: string = '';
  private currentPhone: string = '';
  private cachedInstitutionName: string = '';
  private activeCallData: CallPayload | null = null;
  private isCaller: boolean = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isSubscribed: boolean = false;
  private subscribePromise: Promise<boolean> | null = null;
  private subscribeResolver: ((val: boolean) => void) | null = null;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingReceived: number = Date.now();
  private isSpeakerOn: boolean = true;

  public setSpeaker(enabled: boolean): void {
    this.isSpeakerOn = enabled;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = enabled ? 1.0 : 0.3;
      if ('setSinkId' in this.remoteAudioElement) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then((devices) => {
              const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
              if (audioOutputs.length > 0) {
                const target = enabled
                  ? audioOutputs.find((d) => d.label.toLowerCase().includes('speaker') || d.label.toLowerCase().includes('loudspeaker')) || audioOutputs[0]
                  : audioOutputs.find((d) => d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('receiver')) || audioOutputs[0];
                if (target && target.deviceId) {
                  (this.remoteAudioElement as any).setSinkId(target.deviceId).catch(() => {});
                }
              }
            });
          }
        } catch {}
      }
    }
  }

  public getIsSpeakerOn(): boolean {
    return this.isSpeakerOn;
  }

  // Listeners
  public onStatusChange?: (status: CallStatus, data?: CallPayload) => void;
  public onIncomingCall?: (call: CallPayload) => void;
  public onRemoteStreamReady?: (stream: MediaStream) => void;
  public onError?: (errMessage: string) => void;

  public getActiveCall(): CallPayload | null {
    if (this.activeCallData) return this.activeCallData;
    try {
      const stored = localStorage.getItem('deenora_active_call_payload');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Date.now() - (parsed.timestamp || 0) < 60000) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Parent app bondho theke FCM notification tap kore khulle call offer miss hoy.
   * Tokhon ei method diye admin ke offer abar pathate bola hoy.
   */
  public requestOffer(callId: string) {
    console.log('[VoiceCall] Requesting offer re-send for:', callId);
    this.broadcastSignaling('call:request_offer', { callId });
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudioElement = new Audio();
      this.remoteAudioElement.autoplay = true;
      (this.remoteAudioElement as any).playsInline = true;
    }
  }

  private normPhone(p?: string): string {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    return digits.slice(-10); // Standard Bangladesh 10-digit normalized phone
  }

  /**
   * Initialize signaling channel for the institution and user
   */
  public initSignaling(institutionId: string, userId: string, phone?: string) {
    const cleanInstId = String(institutionId || '').trim();
    const cleanUserId = String(userId || '').trim();
    const cleanPhone = this.normPhone(phone);

    if (!cleanInstId && !cleanUserId && !cleanPhone) return;

    if (
      this.currentInstitutionId === cleanInstId &&
      this.currentUserId === cleanUserId &&
      this.currentPhone === cleanPhone &&
      (this.channel || this.directChannel)
    ) {
      return;
    }

    this.currentInstitutionId = cleanInstId;
    this.currentUserId = cleanUserId;
    this.currentPhone = cleanPhone;

    // Teardown existing channels cleanly
    if (this.channel) {
      try { supabase.removeChannel(this.channel); } catch {}
      this.channel = null;
    }
    if (this.directChannel) {
      try { supabase.removeChannel(this.directChannel); } catch {}
      this.directChannel = null;
    }
    if (this.phoneChannel) {
      try { supabase.removeChannel(this.phoneChannel); } catch {}
      this.phoneChannel = null;
    }

    this.isSubscribed = false;
    this.subscribePromise = new Promise<boolean>((resolve) => {
      this.subscribeResolver = resolve;
    });

    const attachListeners = (ch: any) => {
      ch
        .on('broadcast', { event: 'call:initiate' }, ({ payload }: { payload: CallPayload }) => {
          this.handleIncomingOffer(payload);
        })
        .on('broadcast', { event: 'call:ringing' }, ({ payload }: { payload: CallPayload }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId && this.isCaller) {
            this.onStatusChange?.('calling', this.activeCallData);
          }
        })
        .on('broadcast', { event: 'call:accept' }, async ({ payload }: { payload: CallPayload }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId && this.isCaller) {
            await this.handleRemoteAnswer(payload);
          }
        })
        .on('broadcast', { event: 'call:reject' }, ({ payload }: { payload: CallPayload }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId) {
            this.handleCallRejected(payload.reason);
          }
        })
        .on('broadcast', { event: 'call:candidate' }, async ({ payload }: { payload: CallPayload }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId) {
            await this.handleRemoteCandidate(payload);
          }
        })
        .on('broadcast', { event: 'call:end' }, ({ payload }: { payload: CallPayload }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId) {
            this.handleCallEndedRemotely();
          }
        })
        .on('broadcast', { event: 'call:ping' }, ({ payload }: { payload: { callId: string } }) => {
          if (this.activeCallData && this.activeCallData.callId === payload.callId) {
            this.lastPingReceived = Date.now();
          }
        })
        .on('broadcast', { event: 'call:request_offer' }, ({ payload }: { payload: { callId: string } }) => {
          // Parent app bondho theke khule offer miss koreche → caller abar offer pathabe
          if (this.activeCallData && this.activeCallData.callId === payload.callId && this.isCaller) {
            console.log('[VoiceCall] Re-sending offer for missed call:', payload.callId);
            this.broadcastSignaling('call:initiate', this.activeCallData);
          }
        });
    };

    // 1. Institution-wide channel
    if (cleanInstId) {
      // Fetch and cache institution name asynchronously if available
      (async () => {
        try {
          const { data } = await supabase
            .from('institutions')
            .select('name')
            .eq('id', cleanInstId)
            .maybeSingle();
          if (data?.name) {
            this.cachedInstitutionName = data.name;
          }
        } catch {}
      })();

      const channelName = `institution-calls-${cleanInstId}`;
      this.channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });
      attachListeners(this.channel);
      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[VoiceCall] Institution Channel Connected:', channelName);
          this.isSubscribed = true;
          this.subscribeResolver?.(true);
        }
      });
    }

    // 2. Direct Student ID channel (for guardian portal)
    if (cleanUserId && !cleanUserId.startsWith('admin') && !cleanUserId.startsWith('user-')) {
      const directChannelName = `student-call-${cleanUserId.toLowerCase()}`;
      this.directChannel = supabase.channel(directChannelName, {
        config: { broadcast: { self: false } },
      });
      attachListeners(this.directChannel);
      this.directChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[VoiceCall] Direct Student Channel Connected:', directChannelName);
          this.isSubscribed = true;
          this.subscribeResolver?.(true);
        }
      });
    }

    // 3. Direct Guardian Phone channel
    if (cleanPhone) {
      const phoneChannelName = `phone-call-${cleanPhone}`;
      this.phoneChannel = supabase.channel(phoneChannelName, {
        config: { broadcast: { self: false } },
      });
      attachListeners(this.phoneChannel);
      this.phoneChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[VoiceCall] Direct Phone Channel Connected:', phoneChannelName);
          this.isSubscribed = true;
          this.subscribeResolver?.(true);
        }
      });
    }

    // Auto-register Device FCM Token for Android background call wake-up
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('deenora_fcm_token') : null;
      const bridgeToken = typeof window !== 'undefined' ? (window as any).AndroidBridge?.getFcmToken?.() : null;
      const effectiveToken = storedToken || bridgeToken;
      if (effectiveToken && (cleanPhone || cleanUserId)) {
        fetch('/api/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_token',
            token: effectiveToken,
            phone: cleanPhone || undefined,
            student_id: cleanUserId || undefined,
            institution_id: cleanInstId || undefined,
          }),
        }).catch(() => {});
      }
    } catch {}
  }

  /**
   * Resilient broadcast across all active signaling channels
   */
  private async broadcastSignaling(event: string, payload: any) {
    const promises: Promise<any>[] = [];

    if (this.channel) {
      promises.push(
        this.channel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on main channel failed:', e))
      );
    }
    if (this.directChannel) {
      promises.push(
        this.directChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on direct channel failed:', e))
      );
    }
    if (this.phoneChannel) {
      promises.push(
        this.phoneChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on phone channel failed:', e))
      );
    }

    // If payload has student info, send directly to student's dedicated channel as well
    const studentId = payload?.student?.id;
    if (studentId) {
      const targetChanName = `student-call-${String(studentId).trim().toLowerCase()}`;
      if (!this.directChannel || this.directChannel.topic !== targetChanName) {
        try {
          const directChan = supabase.channel(targetChanName, {
            config: { broadcast: { self: false } },
          });
          directChan.subscribe(async (st: string) => {
            if (st === 'SUBSCRIBED') {
              await directChan.send({ type: 'broadcast', event, payload }).catch(() => {});
            }
          });
        } catch {}
      }
    }

    // If payload has guardian phone, send to phone channel as well
    const guardianPhone = this.normPhone(payload?.calleePhone || payload?.student?.guardian_phone);
    if (guardianPhone) {
      const phoneChanName = `phone-call-${guardianPhone}`;
      if (!this.phoneChannel || this.phoneChannel.topic !== phoneChanName) {
        try {
          const pChan = supabase.channel(phoneChanName, {
            config: { broadcast: { self: false } },
          });
          pChan.subscribe(async (st: string) => {
            if (st === 'SUBSCRIBED') {
              await pChan.send({ type: 'broadcast', event, payload }).catch(() => {});
            }
          });
        } catch {}
      }
    }

    await Promise.all(promises);
  }

  /**
   * Acquire local microphone audio stream
   */
  private async acquireLocalStream(): Promise<MediaStream | null> {
    try {
      if (this.localStream && this.localStream.active) {
        return this.localStream;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('মাইক্রোফোন ব্রাউজারে সাপোর্টেড নয় বা সিকিউর কনটেক্সট (HTTPS) প্রয়োজন।');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;
      return stream;
    } catch (err: any) {
      console.warn('[VoiceCall] MediaDevices getUserMedia error:', err);
      // Fallback dummy audio stream if browser policy blocks mic in some preview environments
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const actx = new AudioCtx();
          const dest = actx.createMediaStreamDestination();
          this.localStream = dest.stream;
          return dest.stream;
        }
      } catch {}
      this.onError?.('মাইক্রোফোন পারমিশন প্রয়োজন। দয়া করে ব্রাউজারে Microphone Allow করুন।');
      return null;
    }
  }

  /**
   * Initialize RTCPeerConnection
   */
  private createPeerConnection(callId: string): RTCPeerConnection {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcastSignaling('call:candidate', {
          callId,
          candidate: event.candidate.toJSON(),
          senderId: this.currentUserId,
          timestamp: Date.now(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[VoiceCall] Received remote audio track', event.streams, event.track);
      let remoteStream: MediaStream;
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
      } else if (event.track) {
        remoteStream = new MediaStream([event.track]);
      } else {
        return;
      }

      if (this.remoteAudioElement) {
        try {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.muted = false;
          this.remoteAudioElement.volume = 1.0;
          const playPromise = this.remoteAudioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('[VoiceCall] remoteAudioElement.play() warning, auto-resuming on user interaction:', err);
            });
          }
        } catch (e) {
          console.warn('[VoiceCall] remoteAudioElement setup error:', e);
        }
      }
      this.onRemoteStreamReady?.(remoteStream);
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceCall] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        callSoundService.playConnectChime();
        this.onStatusChange?.('connected', this.activeCallData || undefined);

        // Start periodic ping heartbeat to keep WebRTC channel active
        if (!this.pingInterval) {
          this.pingInterval = setInterval(() => {
            if (this.activeCallData) {
              this.broadcastSignaling('call:ping', {
                callId: this.activeCallData.callId,
              });
            }
          }, 3000);
        }
      } else if (pc.connectionState === 'disconnected') {
        // Mobile network jitter grace period: allow 7 seconds for automatic ICE reconnect
        console.warn('[VoiceCall] Peer connection disconnected, waiting 7s grace period before ending...');
        if (!this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.warn('[VoiceCall] Connection did not recover, ending call.');
              this.endCall();
            }
          }, 7000);
        }
      } else if (pc.connectionState === 'failed') {
        this.endCall();
      }
    };

    return pc;
  }

  /**
   * Start an outgoing call to Guardian
   */
  public async startCall(
    student: CallStudentInfo,
    caller: CallParticipantInfo,
    institutionId: string
  ): Promise<boolean> {
    try {
      this.isCaller = true;
      const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Ensure signaling channel is connected
      if (!this.channel || this.currentInstitutionId !== institutionId) {
        this.initSignaling(institutionId, caller.id);
      }

      // Wait for channel subscription to be established before sending
      if (!this.isSubscribed && this.subscribePromise) {
        await Promise.race([
          this.subscribePromise,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      }

      const stream = await this.acquireLocalStream();
      const pc = this.createPeerConnection(callId);

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      const payload: CallPayload = {
        callId,
        institutionId,
        caller,
        calleePhone: student.guardian_phone || '',
        student,
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        timestamp: Date.now(),
      };

      this.activeCallData = payload;

      // Start ringing sound
      callSoundService.startOutgoingRingback();
      this.onStatusChange?.('calling', payload);

      // Broadcast offer on all channels
      await this.broadcastSignaling('call:initiate', payload);
      console.log('[VoiceCall] Broadcasted call:initiate:', callId);

      // Trigger High-Priority FCM Push Notification for Android Fcmservice.kt & CallService.kt
      fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate_call_push',
          payload: {
            type: 'incoming_call',
            call_id: callId,
            caller_name: payload.institutionName || payload.caller.institutionName || payload.caller.name || 'মাদরাসা এডমিন',
            student_name: student.name,
            student_id: student.id,
            institution_id: institutionId,
            callee_phone: student.guardian_phone || '',
          },
        }),
      }).catch((fcmErr) => {
        console.warn('[VoiceCall] FCM call push trigger notice:', fcmErr);
      });

      // Send a second pulse after 450ms to ensure delivery even during initial network handshake
      setTimeout(() => {
        if (this.activeCallData && this.activeCallData.callId === callId && this.isCaller) {
          this.broadcastSignaling('call:initiate', payload);
        }
      }, 450);

      return true;
    } catch (error: any) {
      console.error('[VoiceCall] Failed to start call:', error);
      callSoundService.stopAll();
      this.onStatusChange?.('failed');
      this.onError?.(error.message || 'ভয়েস কল শুরু করা সম্ভব হয়নি।');
      return false;
    }
  }

  /**
   * Handle incoming call offer on Callee (Guardian / Teacher)
   */
  private async handleIncomingOffer(payload: CallPayload) {
    // 1. Ignore if current user is the caller or we initiated this call
    if (this.isCaller || String(this.currentUserId) === String(payload.caller.id)) {
      return;
    }

    // 2. Normalize and check if this call belongs to this user or student
    const norm = (s?: any) => String(s || '').trim().toLowerCase();
    const myId = norm(this.currentUserId);
    const targetStudentId = norm(payload.student.id);

    const myPhone = this.normPhone(this.currentPhone || this.currentUserId);
    const targetPhone = this.normPhone(payload.calleePhone || payload.student.guardian_phone);

    const isIdMatch = Boolean(myId && targetStudentId && (myId === targetStudentId || myId.includes(targetStudentId) || targetStudentId.includes(myId)));
    const isPhoneMatch = Boolean(myPhone && targetPhone && myPhone === targetPhone);
    const isParentPrefix = myId.startsWith('parent') && (myId.includes(targetStudentId) || (targetPhone && myId.includes(targetPhone)));
    
    // NOTE (2026-10-04 fix): removed the old "isStaffOrAdmin" catch-all
    // (!myId.startsWith('parent')). It matched EVERY connected user of the
    // institution (parents log in with UUID/phone ids that don't start with
    // 'parent'), so every call rang everyone. Now only the targeted parent
    // (matched by student id or guardian phone) sees the incoming call.
    const isForMe = isIdMatch || isPhoneMatch || isParentPrefix;

    if (!isForMe) {
      return;
    }

    console.log('[VoiceCall] Incoming offer matched! Ringing incoming call modal...', {
      myId,
      targetStudentId,
      myPhone,
      targetPhone,
    });

    // If already in a call, send busy
    if (this.activeCallData && this.activeCallData.callId !== payload.callId) {
      this.broadcastSignaling('call:reject', {
        callId: payload.callId,
        reason: 'ব্যবহারকারী অন্য কলে ব্যস্ত আছেন।',
      });
      return;
    }

    this.isCaller = false;

    // Ensure institutionName is filled
    if (!payload.institutionName && !payload.caller?.institutionName) {
      if (this.cachedInstitutionName) {
        payload.institutionName = this.cachedInstitutionName;
        if (payload.caller) payload.caller.institutionName = this.cachedInstitutionName;
      }
    }

    this.activeCallData = payload;

    try {
      localStorage.setItem('deenora_active_call_payload', JSON.stringify(payload));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('deenora_call_events');
        bc.postMessage({ type: 'INCOMING_CALL', payload });
        setTimeout(() => bc.close(), 1000);
      }
    } catch {}

    // Start incoming ringtone
    callSoundService.startIncomingRingtone();
    this.onStatusChange?.('incoming', payload);
    this.onIncomingCall?.(payload);

    // Format clean caller name for notification (avoiding raw email strings)
    const rawCaller = payload.institutionName || payload.caller.institutionName || payload.caller.name || '';
    const cleanCallerName = (rawCaller.includes('@') || rawCaller.toLowerCase().includes('gmail') || rawCaller.toLowerCase().includes('.com'))
      ? (payload.institutionName || payload.caller.institutionName || 'Institution Admin')
      : (rawCaller || 'Institution Admin');

    // Show WhatsApp-style persistent lock-screen / mobile screen notification
    showIncomingCallNotification({
      callId: payload.callId,
      callerName: cleanCallerName,
      studentName: payload.student.name,
      photoUrl: payload.student.photo_url,
    });

    // Notify caller that phone is ringing
    this.broadcastSignaling('call:ringing', {
      callId: payload.callId,
      calleeId: this.currentUserId,
    });
  }

  /**
   * Accept incoming call
   */
  public async acceptCall(): Promise<boolean> {
    if (!this.activeCallData || !this.activeCallData.offer) {
      return false;
    }

    try {
      callSoundService.stopAll();
      dismissIncomingCallNotification();
      const callId = this.activeCallData.callId;
      const pc = this.createPeerConnection(callId);

      const stream = await this.acquireLocalStream();
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(this.activeCallData.offer));

      // Process buffered ICE candidates
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Broadcast accept across channels
      await this.broadcastSignaling('call:accept', {
        callId,
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        calleeName: this.activeCallData.student.guardian_name || 'অভিভাবক',
        timestamp: Date.now(),
      });

      this.onStatusChange?.('connected', this.activeCallData);
      callSoundService.playConnectChime();
      return true;
    } catch (error: any) {
      console.error('[VoiceCall] Error accepting call:', error);
      callSoundService.stopAll();
      this.rejectCall('কল রিসিভ করতে সমস্যা হয়েছে।');
      return false;
    }
  }

  /**
   * Caller receives remote answer
   */
  private async handleRemoteAnswer(payload: CallPayload) {
    if (!this.peerConnection || !payload.answer) return;

    try {
      callSoundService.stopAll();
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
      
      // Process pending candidates
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        if (candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      }

      callSoundService.playConnectChime();
      this.onStatusChange?.('connected', this.activeCallData || undefined);
    } catch (e) {
      console.error('[VoiceCall] Failed setting remote answer:', e);
    }
  }

  /**
   * Handle incoming remote ICE Candidate
   */
  private async handleRemoteCandidate(payload: CallPayload) {
    if (!payload.candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.warn('[VoiceCall] Failed adding ICE candidate:', e);
      }
    } else {
      this.pendingCandidates.push(payload.candidate);
    }
  }

  /**
   * Reject incoming call
   */
  public rejectCall(reason: string = 'কলটি কেটে দেওয়া হয়েছে।') {
    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();

    if (this.activeCallData) {
      this.broadcastSignaling('call:reject', {
        callId: this.activeCallData.callId,
        reason,
        timestamp: Date.now(),
      });
    }

    this.cleanup();
    this.onStatusChange?.('rejected');
  }

  /**
   * Call was rejected by other party
   */
  private handleCallRejected(reason?: string) {
    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();
    this.cleanup();
    this.onStatusChange?.('rejected', this.activeCallData || undefined);
    if (reason) {
      this.onError?.(reason);
    }
  }

  /**
   * Hang up / End active call
   */
  public endCall() {
    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();

    if (this.activeCallData) {
      this.broadcastSignaling('call:end', {
        callId: this.activeCallData.callId,
        timestamp: Date.now(),
      });
    }

    this.cleanup();
    this.onStatusChange?.('ended');
  }

  /**
   * Call ended by remote peer
   */
  private handleCallEndedRemotely() {
    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();
    this.cleanup();
    this.onStatusChange?.('ended', this.activeCallData || undefined);
  }

  /**
   * Toggle mute on local microphone
   */
  public setMuted(muted: boolean): boolean {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      return muted;
    }
    return false;
  }

  /**
   * Cleanup connections and media tracks
   */
  private cleanup() {
    dismissIncomingCallNotification();
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    try {
      localStorage.removeItem('deenora_active_call_payload');
    } catch {}

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.localStream = null;
    }

    if (this.remoteAudioElement) {
      try {
        this.remoteAudioElement.srcObject = null;
      } catch {}
    }

    this.activeCallData = null;
    this.pendingCandidates = [];
  }

  /**
   * Full destruction
   */
  public destroy() {
    dismissIncomingCallNotification();
    this.cleanup();
    callSoundService.stopAll();
    if (this.channel) {
      try { supabase.removeChannel(this.channel); } catch {}
      this.channel = null;
    }
    if (this.directChannel) {
      try { supabase.removeChannel(this.directChannel); } catch {}
      this.directChannel = null;
    }
    if (this.phoneChannel) {
      try { supabase.removeChannel(this.phoneChannel); } catch {}
      this.phoneChannel = null;
    }
  }
}

export const voiceCallService = new VoiceCallService();
