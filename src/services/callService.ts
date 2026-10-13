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
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
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
  private userChannel: any = null;
  private callRoomChannel: any = null;
  private callerExtraChannels: any[] = [];
  private dataChannel: RTCDataChannel | null = null;
  private currentInstitutionId: string = '';
  private currentUserId: string = '';
  private currentPhone: string = '';
  private cachedInstitutionName: string = '';
  private activeCallData: CallPayload | null = null;
  private isCaller: boolean = false;
  private isCallAnswered: boolean = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isSubscribed: boolean = false;
  private subscribePromise: Promise<boolean> | null = null;
  private subscribeResolver: ((val: boolean) => void) | null = null;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private outgoingRingTimeout: NodeJS.Timeout | null = null;
  private incomingRingTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private lastPingReceived: number = Date.now();
  private isSpeakerOn: boolean = true;

  // Realtime connection health & auto-reconnect state
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly INITIAL_RECONNECT_DELAY: number = 1000;
  private readonly MAX_RECONNECT_DELAY: number = 30000;
  private readonly BACKOFF_FACTOR: number = 1.5;
  private isReconnecting: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private handleUnload: (() => void) | null = null;
  private handleVisibilityChange: (() => void) | null = null;
  private handleOnline: (() => void) | null = null;
  // Android Native Bridge & duplicate offer guard state
  private isNativeBridgeActive: boolean = false;
  private currentRingingCallId: string | null = null;

  // Staged / Pending auto-answer state (for Android Native Action / URL ?answer=1)
  private pendingAutoAnswerCallId: string | null = null;
  private autoAnswerTimer: NodeJS.Timeout | null = null;

  public hasNativeBridge(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).AndroidInterface?.onIncomingCall);
  }

  public getIsNativeBridgeActive(): boolean {
    return this.isNativeBridgeActive;
  }

  public setPendingAutoAnswer(callId: string | null) {
    this.pendingAutoAnswerCallId = callId ? String(callId).trim() : null;
    if (this.autoAnswerTimer) {
      clearTimeout(this.autoAnswerTimer);
      this.autoAnswerTimer = null;
    }
    if (this.pendingAutoAnswerCallId) {
      this.autoAnswerTimer = setTimeout(() => {
        if (this.pendingAutoAnswerCallId === callId) {
          console.log('[VoiceCall] Pending auto-answer timeout expired for:', callId);
          this.pendingAutoAnswerCallId = null;
        }
      }, 45000);
    }
  }

  public getPendingAutoAnswer(): string | null {
    return this.pendingAutoAnswerCallId;
  }

  /**
   * Handle native call action invoked by Android WebView bridge or background notifications:
   * action: 'answer' | 'decline' | 'end'
   */
  public async handleNativeAction(action: string, callId?: string): Promise<boolean> {
    const act = String(action || '').toLowerCase().trim();
    console.log('[VoiceCall] handleNativeAction invoked:', { action: act, callId });

    if (act === 'answer' || act === 'accept' || act === 'accept_call') {
      // 1. Tell Android native to stop ringing sound immediately
      if (typeof window !== 'undefined' && window.AndroidInterface?.stopRinging) {
        try { window.AndroidInterface.stopRinging(); } catch {}
      }
      callSoundService.stopAll();

      // 2. Check if we already have the activeCallData or stored call matching callId
      const currentCall = this.activeCallData || this.getActiveCall();
      const isMatchingCall = currentCall && (!callId || currentCall.callId === callId);

      if (isMatchingCall && currentCall?.offer) {
        console.log('[VoiceCall] Found active offer matching callId, accepting WebRTC immediately:', currentCall.callId);
        this.activeCallData = currentCall;
        const accepted = await this.acceptCall();
        return accepted;
      }

      // 3. If offer not yet in memory (or socket delivery in flight):
      // Stage callId so when handleIncomingOffer fires, it automatically accepts instead of ringing!
      const targetId = callId ? String(callId).trim() : '__ANY__';
      console.log('[VoiceCall] Staging auto-answer for upcoming offer:', targetId);
      this.setPendingAutoAnswer(targetId);

      if (callId) {
        this.subscribeCallRoom(callId);
        this.requestOffer(callId);
      }
      return true;
    } else if (act === 'decline' || act === 'reject' || act === 'reject_call') {
      if (typeof window !== 'undefined' && window.AndroidInterface?.stopRinging) {
        try { window.AndroidInterface.stopRinging(); } catch {}
      }
      callSoundService.stopAll();
      this.setPendingAutoAnswer(null);
      await this.rejectCall('Android Native UI থেকে কল বাতিল করা হয়েছে।', callId);
      return true;
    } else if (act === 'end_call' || act === 'hangup' || act === 'end') {
      if (typeof window !== 'undefined' && window.AndroidInterface?.stopRinging) {
        try { window.AndroidInterface.stopRinging(); } catch {}
      }
      this.setPendingAutoAnswer(null);
      await this.endCall();
      return true;
    }

    return false;
  }

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

      // Auto-hangup when tab is closed or user navigates away
      this.handleUnload = () => {
        if (this.activeCallData) {
          this.endCall();
        }
      };
      window.addEventListener('beforeunload', this.handleUnload);
      window.addEventListener('pagehide', this.handleUnload);

      // Listen for cross-tab hangup / reject events
      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('deenora_call_events');
          bc.onmessage = (event) => {
            const data = event.data;
            if (data?.type === 'CALL_ENDED' || data?.type === 'CALL_REJECTED') {
              if (this.activeCallData && (!data.payload?.callId || this.activeCallData.callId === data.payload.callId)) {
                this.handleCallEndedRemotely();
              }
            }
          };
        } catch {}
      }

      // App foreground (visibilitychange) connection health check & reconnect
      if (typeof document !== 'undefined') {
        this.handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            console.log('[VoiceCall] App came to foreground (visibilitychange), checking realtime connection health...');
            this.checkConnectionHealth(true);
          }
        };
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }

      // Online event: network restored, verify connection immediately
      this.handleOnline = () => {
        console.log('[VoiceCall] Network back online, checking realtime connection health...');
        this.checkConnectionHealth(true);
      };
      window.addEventListener('online', this.handleOnline);

      // Periodic connection health check (every 25 seconds)
      this.startHealthCheckLoop();
    }
  }

  private normPhone(p?: string): string {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    return digits.slice(-10); // Standard Bangladesh 10-digit normalized phone
  }

  /**
   * Attach common call signaling event listeners to any channel
   */
  private attachCallListeners(ch: any) {
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
        if (this.activeCallData && (!payload.callId || this.activeCallData.callId === payload.callId)) {
          console.log('[VoiceCall] Received call:reject from peer:', payload);
          this.handleCallRejected(payload.reason);
        }
      })
      .on('broadcast', { event: 'call:candidate' }, async ({ payload }: { payload: CallPayload }) => {
        if (this.activeCallData && this.activeCallData.callId === payload.callId) {
          await this.handleRemoteCandidate(payload);
        }
      })
      .on('broadcast', { event: 'call:end' }, ({ payload }: { payload: CallPayload }) => {
        if (this.activeCallData && (!payload.callId || this.activeCallData.callId === payload.callId)) {
          console.log('[VoiceCall] Received call:end from peer:', payload);
          this.handleCallEndedRemotely();
        }
      })
      .on('broadcast', { event: 'call:ping' }, ({ payload }: { payload: { callId: string } }) => {
        if (this.activeCallData && this.activeCallData.callId === payload.callId) {
          this.lastPingReceived = Date.now();
        }
      })
      .on('broadcast', { event: 'call:request_offer' }, ({ payload }: { payload: { callId: string } }) => {
        if (this.activeCallData && this.activeCallData.callId === payload.callId && this.isCaller) {
          console.log('[VoiceCall] Re-sending offer for missed call:', payload.callId);
          this.broadcastSignaling('call:initiate', this.activeCallData);
        }
      });
  }

  /**
   * Dedicated per-call room channel ensuring 100% direct caller <-> callee signaling
   */
  public subscribeCallRoom(callId: string) {
    if (!callId) return;
    if (this.callRoomChannel) {
      try { supabase.removeChannel(this.callRoomChannel); } catch {}
      this.callRoomChannel = null;
    }

    const roomName = `call-room-${callId}`;
    this.callRoomChannel = supabase.channel(roomName, {
      config: { broadcast: { self: false } },
    });
    this.attachCallListeners(this.callRoomChannel);
    this.callRoomChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[VoiceCall] Call room channel active:', roomName);
      }
    });
  }

  /**
   * Set up WebRTC DataChannel for instantaneous 0ms peer-to-peer hangup & control
   */
  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;
    dc.onopen = () => {
      console.log('[VoiceCall] RTCDataChannel open for zero-latency control');
    };
    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[VoiceCall] DataChannel message received:', msg);
        if (msg.type === 'call:end' || msg.type === 'call:reject') {
          this.handleCallEndedRemotely();
        }
      } catch {}
    };
    dc.onclose = () => {
      console.log('[VoiceCall] RTCDataChannel closed by peer');
      if (this.activeCallData && this.peerConnection) {
        this.handleCallEndedRemotely();
      }
    };
  }

  /**
   * Monitor individual channel status changes and handle disconnection/error with auto-reconnect
   */
  private monitorChannelSubscription(ch: any, name: string) {
    ch.subscribe((status: string, err?: any) => {
      console.log(`[VoiceCall] Channel ${name} status: ${status}`, err || '');
      if (status === 'SUBSCRIBED') {
        this.isSubscribed = true;
        this.subscribeResolver?.(true);
        // Reset reconnect attempts on successful subscription
        if (this.reconnectAttempts > 0) {
          console.log(`[VoiceCall] Reconnected successfully to channel ${name}. Resetting backoff attempts.`);
          this.reconnectAttempts = 0;
        }
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.warn(`[VoiceCall] Channel ${name} unhealthy state: ${status}. Scheduling auto-reconnect...`, err || '');
        this.isSubscribed = false;
        this.scheduleReconnect(false);
      }
    });
  }

  /**
   * Periodic connection health check loop (runs every 25s)
   */
  private startHealthCheckLoop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth(false);
    }, 25000);
  }

  /**
   * Check connection health of Supabase Realtime client and active channels
   */
  public checkConnectionHealth(forceReconnect: boolean = false): boolean {
    const hasCredentials = Boolean(this.currentInstitutionId || this.currentUserId || this.currentPhone);
    if (!hasCredentials) {
      return true;
    }

    let isHealthy = true;

    // 1. Verify Supabase Realtime client socket connection
    try {
      if (supabase && (supabase as any).realtime) {
        if (!(supabase as any).realtime.isConnected?.()) {
          console.warn('[VoiceCall] Realtime client is NOT connected');
          isHealthy = false;
        }
      }
    } catch {}

    // 2. Verify channel subscriptions
    const activeChannels = [this.channel, this.userChannel, this.directChannel, this.phoneChannel].filter(Boolean);
    if (activeChannels.length === 0 && hasCredentials) {
      isHealthy = false;
    } else {
      for (const ch of activeChannels) {
        if (!ch || ch.state === 'closed' || ch.state === 'leaving') {
          console.warn(`[VoiceCall] Channel ${ch?.topic || 'unknown'} state is ${ch?.state}`);
          isHealthy = false;
          break;
        }
      }
    }

    if (!isHealthy || forceReconnect) {
      console.log(`[VoiceCall] Connection health check triggered reconnect (healthy: ${isHealthy}, force: ${forceReconnect})`);
      this.scheduleReconnect(forceReconnect);
      return false;
    }

    return true;
  }

  /**
   * Schedule auto-reconnect with exponential backoff
   */
  public scheduleReconnect(immediate: boolean = false) {
    if (immediate) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this.performReconnect();
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    const backoffDelay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(this.BACKOFF_FACTOR, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    const jitter = Math.floor(Math.random() * 500);
    const totalDelay = Math.round(backoffDelay + jitter);

    this.reconnectAttempts++;
    console.log(`[VoiceCall] Auto-reconnect attempt #${this.reconnectAttempts} scheduled in ${totalDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.performReconnect();
    }, totalDelay);
  }

  /**
   * Execute reconnection of supabase realtime channels
   */
  private async performReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    try {
      console.log('[VoiceCall] Performing Supabase realtime channels reconnection...');

      // 1. Reconnect realtime socket if disconnected
      if (supabase && (supabase as any).realtime) {
        try {
          if (!(supabase as any).realtime.isConnected?.()) {
            (supabase as any).realtime.connect?.();
          }
        } catch (e) {
          console.warn('[VoiceCall] Realtime socket connect notice:', e);
        }
      }

      // 2. Re-bind signaling channels
      if (this.currentInstitutionId || this.currentUserId || this.currentPhone) {
        await this.bindChannels();
      }
    } catch (err) {
      console.error('[VoiceCall] Error during performReconnect:', err);
      this.scheduleReconnect(false);
    } finally {
      this.isReconnecting = false;
    }
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
      (this.channel || this.directChannel) &&
      this.isSubscribed
    ) {
      return;
    }

    this.currentInstitutionId = cleanInstId;
    this.currentUserId = cleanUserId;
    this.currentPhone = cleanPhone;

    this.bindChannels();

    // Auto-register Device FCM Token for Android background call wake-up
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('deenora_fcm_token') : null;
      const bridgeToken = typeof window !== 'undefined' ? (window as any).AndroidInterface?.getFcmToken?.() : null;
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
   * Bind and subscribe all required signaling channels
   */
  private async bindChannels() {
    const cleanInstId = this.currentInstitutionId;
    const cleanUserId = this.currentUserId;
    const cleanPhone = this.currentPhone;

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
    if (this.userChannel) {
      try { supabase.removeChannel(this.userChannel); } catch {}
      this.userChannel = null;
    }

    this.isSubscribed = false;
    this.subscribePromise = new Promise<boolean>((resolve) => {
      this.subscribeResolver = resolve;
    });

    // 1. Institution-wide channel
    if (cleanInstId) {
      if (!this.cachedInstitutionName) {
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
      }

      const channelName = `institution-calls-${cleanInstId}`;
      this.channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });
      this.attachCallListeners(this.channel);
      this.monitorChannelSubscription(this.channel, channelName);
    }

    // 2. Direct User ID channel (for Admin, Teacher, or any logged in user)
    if (cleanUserId) {
      const userChanName = `user-call-${cleanUserId.toLowerCase()}`;
      this.userChannel = supabase.channel(userChanName, {
        config: { broadcast: { self: false } },
      });
      this.attachCallListeners(this.userChannel);
      this.monitorChannelSubscription(this.userChannel, userChanName);
    }

    // 3. Direct Student ID channel (for guardian portal)
    if (cleanUserId && !cleanUserId.startsWith('admin') && !cleanUserId.startsWith('user-')) {
      const directChannelName = `student-call-${cleanUserId.toLowerCase()}`;
      this.directChannel = supabase.channel(directChannelName, {
        config: { broadcast: { self: false } },
      });
      this.attachCallListeners(this.directChannel);
      this.monitorChannelSubscription(this.directChannel, directChannelName);
    }

    // 4. Direct Guardian Phone channel
    if (cleanPhone) {
      const phoneChannelName = `phone-call-${cleanPhone}`;
      this.phoneChannel = supabase.channel(phoneChannelName, {
        config: { broadcast: { self: false } },
      });
      this.attachCallListeners(this.phoneChannel);
      this.monitorChannelSubscription(this.phoneChannel, phoneChannelName);
    }
  }

  /**
   * Resilient broadcast across all active signaling channels
   */
  private async broadcastSignaling(event: string, payload: any) {
    const promises: Promise<any>[] = [];

    // 1. Direct WebRTC DataChannel (0ms latency direct transport)
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: event, ...payload }));
      } catch (dcErr) {
        console.warn('[VoiceCall] DataChannel send warning:', dcErr);
      }
    }

    // 2. Dedicated Call Room Channel (Direct session channel between caller and callee)
    const targetRoomCallId = payload?.callId || this.activeCallData?.callId;
    if (this.callRoomChannel) {
      promises.push(
        this.callRoomChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on call room channel failed:', e))
      );
    }
    if (targetRoomCallId) {
      const roomChanName = `call-room-${targetRoomCallId}`;
      if (!this.callRoomChannel || this.callRoomChannel.topic !== roomChanName) {
        try {
          const rChan = supabase.channel(roomChanName, {
            config: { broadcast: { self: false } },
          });
          rChan.subscribe(async (st: string) => {
            if (st === 'SUBSCRIBED') {
              await rChan.send({ type: 'broadcast', event, payload }).catch(() => {});
            }
          });
        } catch {}
      }
    }

    // 3. Main Institution Channel
    if (this.channel) {
      promises.push(
        this.channel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on main channel failed:', e))
      );
    }

    // 4. Direct Student Channel
    if (this.directChannel) {
      promises.push(
        this.directChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on direct channel failed:', e))
      );
    }

    // 5. Direct Phone Channel
    if (this.phoneChannel) {
      promises.push(
        this.phoneChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on phone channel failed:', e))
      );
    }

    // 6. Direct User Channel of current user if active
    if (this.userChannel) {
      promises.push(
        this.userChannel
          .send({ type: 'broadcast', event, payload })
          .catch((e: any) => console.warn('[VoiceCall] broadcast on userChannel failed:', e))
      );
    }

    // 7. Direct Caller's dedicated channel (Guarantees Admin panel receives reject/end instantly!)
    const callerId = payload?.caller?.id || this.activeCallData?.caller?.id;
    if (callerId) {
      const callerChanName = `user-call-${String(callerId).trim().toLowerCase()}`;
      if (!this.userChannel || this.userChannel.topic !== callerChanName) {
        try {
          const cChan = supabase.channel(callerChanName, {
            config: { broadcast: { self: false } },
          });
          cChan.subscribe(async (st: string) => {
            if (st === 'SUBSCRIBED') {
              await cChan.send({ type: 'broadcast', event, payload }).catch(() => {});
            }
          });
        } catch {}
      }
    }

    // 8. Target student's dedicated channel
    const studentId = payload?.student?.id || payload?.studentId || this.activeCallData?.student?.id;
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

    // 7. Target guardian phone's dedicated channel
    const guardianPhone = this.normPhone(
      payload?.calleePhone ||
      payload?.student?.guardian_phone ||
      this.activeCallData?.calleePhone ||
      this.activeCallData?.student?.guardian_phone
    );
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

    // 8. Target institution channel if known
    const targetInstId = String(payload?.institutionId || this.activeCallData?.institutionId || '').trim();
    if (targetInstId && (!this.channel || this.channel.topic !== `institution-calls-${targetInstId}`)) {
      try {
        const instChan = supabase.channel(`institution-calls-${targetInstId}`, {
          config: { broadcast: { self: false } },
        });
        instChan.subscribe(async (st: string) => {
          if (st === 'SUBSCRIBED') {
            await instChan.send({ type: 'broadcast', event, payload }).catch(() => {});
          }
        });
      } catch {}
    }

    await Promise.all(promises);
  }

  /**
   * Acquire local microphone audio stream
   */
  /**
   * Acquire local microphone audio stream
   */
  private async acquireLocalStream(): Promise<MediaStream | null> {
    try {
      if (this.localStream && this.localStream.active) {
        console.log('[VoiceCall] Reusing active local stream. Track count:', this.localStream.getAudioTracks().length);
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
          console.log('[VoiceCall] Local audio track verified:', { id: track.id, enabled: track.enabled, readyState: track.readyState });
        });
        return this.localStream;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('মাইক্রোফোন ব্রাউজারে সাপোর্টেড নয় বা সিকিউর কনটেক্সট (HTTPS) প্রয়োজন।');
      }
      console.log('[VoiceCall] Requesting getUserMedia audio permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const audioTracks = stream.getAudioTracks();
      console.log('[VoiceCall] getUserMedia SUCCESS! Audio tracks count:', audioTracks.length);
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = true;
          console.log('[VoiceCall] Local audio track verified:', {
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          });
        });
      } else {
        console.warn('[VoiceCall] getUserMedia succeeded but returned 0 audio tracks!');
      }
      this.localStream = stream;
      return stream;
    } catch (err: any) {
      console.error('[VoiceCall] getUserMedia FAILURE:', err);
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const actx = new AudioCtx();
          const dest = actx.createMediaStreamDestination();
          this.localStream = dest.stream;
          console.log('[VoiceCall] Fallback silent AudioContext destination stream created');
          return dest.stream;
        }
      } catch {}
      this.onError?.('মাইক্রোফোন পারমিশন প্রয়োজন। দয়া করে ব্রাউজারে Microphone Allow করুন।');
      return null;
    }
  }

  /**
   * Bidirectional ping heartbeat and watchdog timer
   */
  private startHeartbeatAndWatchdog() {
    this.lastPingReceived = Date.now();

    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => {
        if (this.activeCallData) {
          this.broadcastSignaling('call:ping', {
            callId: this.activeCallData.callId,
            senderId: this.currentUserId,
            timestamp: Date.now(),
          });
        }
      }, 2000);
    }

    if (!this.watchdogInterval) {
      this.watchdogInterval = setInterval(() => {
        if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
          // If no heartbeat ping received for 20 seconds, assume peer has disconnected / closed tab
          if (Date.now() - this.lastPingReceived > 20000) {
            console.warn('[VoiceCall] Heartbeat timeout (no ping received for 20s), disconnecting call');
            this.handleCallEndedRemotely();
          }
        }
      }, 3000);
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

    // Zero-latency hangup & control DataChannel
    if (this.isCaller) {
      try {
        const dc = pc.createDataChannel('call_control', { negotiated: false });
        this.setupDataChannel(dc);
      } catch (e) {
        console.warn('[VoiceCall] Error creating DataChannel:', e);
      }
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }

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
      console.log('[VoiceCall] ontrack fired! Stream count:', event.streams?.length, 'Track:', event.track?.id, 'kind:', event.track?.kind);
      let remoteStream: MediaStream;
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
      } else if (event.track) {
        remoteStream = new MediaStream([event.track]);
      } else {
        console.warn('[VoiceCall] ontrack received without stream or track!');
        return;
      }

      if (this.remoteAudioElement) {
        try {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.muted = false; // verify unmuted!
          this.remoteAudioElement.volume = this.isSpeakerOn ? 1.0 : 0.85;
          console.log('[VoiceCall] Attached remoteStream to remoteAudioElement. muted:', this.remoteAudioElement.muted, 'volume:', this.remoteAudioElement.volume);
          const playPromise = this.remoteAudioElement.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('[VoiceCall] remoteAudioElement playback active! muted:', this.remoteAudioElement?.muted);
              })
              .catch((err) => {
                console.warn('[VoiceCall] remoteAudioElement.play() warning, auto-resuming on user interaction:', err);
                const resumeAudio = () => {
                  if (this.remoteAudioElement) {
                    this.remoteAudioElement.muted = false;
                    this.remoteAudioElement.play().catch(() => {});
                  }
                  window.removeEventListener('click', resumeAudio);
                  window.removeEventListener('touchend', resumeAudio);
                };
                window.addEventListener('click', resumeAudio);
                window.addEventListener('touchend', resumeAudio);
              });
          }
        } catch (e) {
          console.warn('[VoiceCall] remoteAudioElement setup error:', e);
        }
      }
      this.onRemoteStreamReady?.(remoteStream);
    };

    // Immediate ICE connection state monitoring with automatic ICE restart on failed/disconnected
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[VoiceCall] ICE Connection state change:', state);

      if (state === 'failed' || state === 'disconnected') {
        console.warn(`[VoiceCall] ICE connection state is "${state}", triggering ICE restart...`);
        try {
          if (typeof (pc as any).restartIce === 'function') {
            (pc as any).restartIce();
            console.log('[VoiceCall] pc.restartIce() executed');
          }
          if (this.isCaller && this.activeCallData) {
            pc.createOffer({ iceRestart: true })
              .then(async (newOffer) => {
                await pc.setLocalDescription(newOffer);
                await this.broadcastSignaling('call:offer', {
                  callId: this.activeCallData!.callId,
                  offer: newOffer,
                  senderId: this.currentUserId,
                  timestamp: Date.now(),
                });
                console.log('[VoiceCall] ICE restart offer sent successfully');
              })
              .catch((err) => {
                console.warn('[VoiceCall] Failed to send ICE restart offer:', err);
              });
          }
        } catch (iceErr) {
          console.warn('[VoiceCall] Error during ICE restart attempt:', iceErr);
        }

        // Give a 15-second grace period for ICE recovery / network switch before ending call
        if (!this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
              console.warn('[VoiceCall] ICE reconnect failed after 15s grace period, ending call');
              this.handleCallEndedRemotely();
            }
          }, 15000);
        }
      } else if (state === 'connected' || state === 'completed') {
        console.log('[VoiceCall] ICE connection healthy and stable:', state);
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceCall] Connection state change:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        if (this.outgoingRingTimeout) {
          clearTimeout(this.outgoingRingTimeout);
          this.outgoingRingTimeout = null;
        }
        callSoundService.playConnectChime();
        this.onStatusChange?.('connected', this.activeCallData || undefined);
        this.startHeartbeatAndWatchdog();
      } else if (pc.connectionState === 'disconnected') {
        if (!this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              console.warn('[VoiceCall] Connection state disconnected grace period (15s) expired, ending call');
              this.handleCallEndedRemotely();
            }
          }, 15000);
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handleCallEndedRemotely();
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
      this.isCallAnswered = false;
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

      // 1. Subscribe immediately to dedicated Call Room channel
      this.subscribeCallRoom(callId);

      // 2. Caller also listens on Student and Phone channels for any direct signals from Callee
      if (student.id) {
        const studentChanName = `student-call-${String(student.id).trim().toLowerCase()}`;
        const sChan = supabase.channel(studentChanName, { config: { broadcast: { self: false } } });
        this.attachCallListeners(sChan);
        sChan.subscribe();
        this.callerExtraChannels.push(sChan);
      }
      const normGuardianPhone = this.normPhone(student.guardian_phone);
      if (normGuardianPhone) {
        const phoneChanName = `phone-call-${normGuardianPhone}`;
        const pChan = supabase.channel(phoneChanName, { config: { broadcast: { self: false } } });
        this.attachCallListeners(pChan);
        pChan.subscribe();
        this.callerExtraChannels.push(pChan);
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

      // 3. Outgoing Ring Timeout (45 seconds): automatically end if parent does not answer
      if (this.outgoingRingTimeout) {
        clearTimeout(this.outgoingRingTimeout);
      }
      this.outgoingRingTimeout = setTimeout(() => {
        if (this.activeCallData && this.activeCallData.callId === callId && this.isCaller) {
          console.log('[VoiceCall] Outgoing call unanswered timeout (45s)');
          fetch('/api/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'cancel_call_push',
              call_id: callId,
              callee_phone: student.guardian_phone,
              student_id: student.id,
              institution_id: institutionId,
            }),
          }).catch(() => {});

          callSoundService.stopAll();
          callSoundService.playDisconnectChime();
          this.onError?.('অভিভাবক কল রিসিভ করেননি (কোনো উত্তর নেই)');
          this.endCall();
        }
      }, 45000);

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
      this.cleanup();
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
    if (this.isCaller || String(this.currentUserId) === String(payload.caller?.id)) {
      console.log('[VoiceCall] Incoming offer ignored: Current user is caller/initiator', {
        isCaller: this.isCaller,
        currentUserId: this.currentUserId,
        callerId: payload.caller?.id,
        callId: payload.callId,
      });
      return;
    }

    // 2. Normalize and check if this call belongs to this user or student
    const norm = (s?: any) => String(s || '').trim().toLowerCase();
    const myId = norm(this.currentUserId);
    const targetStudentId = norm(payload.student?.id);

    const myPhone = this.normPhone(this.currentPhone || this.currentUserId);
    const targetPhone = this.normPhone(payload.calleePhone || payload.student?.guardian_phone);

    const isIdMatch = Boolean(myId && targetStudentId && (myId === targetStudentId || myId.includes(targetStudentId) || targetStudentId.includes(myId)));
    const isPhoneMatch = Boolean(myPhone && targetPhone && myPhone === targetPhone);
    const isParentPrefix = myId.startsWith('parent') && (myId.includes(targetStudentId) || (targetPhone && myId.includes(targetPhone)));
    
    const isForMe = isIdMatch || isPhoneMatch || isParentPrefix;

    if (!isForMe) {
      console.log('[VoiceCall] Incoming offer ignored: Call is not targeted for current user/student/phone', {
        myId,
        targetStudentId,
        myPhone,
        targetPhone,
        callId: payload.callId,
      });
      return;
    }

    console.log('[VoiceCall] Incoming offer matched! Ringing incoming call modal...', {
      myId,
      targetStudentId,
      myPhone,
      targetPhone,
    });

    // 5.1 Guard: If already handling/ringing this exact callId, do not trigger duplicate bridge or restart ring
    if (this.activeCallData && this.activeCallData.callId === payload.callId) {
      if (this.isCallAnswered || this.currentRingingCallId === payload.callId) {
        console.log('[VoiceCall] Duplicate incoming offer ignored for already active/ringing callId:', payload.callId);
        if (payload.offer && !this.activeCallData.offer) {
          this.activeCallData.offer = payload.offer;
        }
        return;
      }
    }

    // Guard: If already in a call with a DIFFERENT callId:
    if (this.activeCallData && this.activeCallData.callId !== payload.callId) {
      // Check if user is ACTUALLY connected and actively talking on another call
      const isTrulyBusy =
        this.isCallAnswered &&
        this.peerConnection &&
        (this.peerConnection.connectionState === 'connected' || this.peerConnection.connectionState === 'connecting');

      if (isTrulyBusy) {
        console.log('[VoiceCall] Callee currently in an active connected call. Rejecting new call offer as busy.');
        this.broadcastSignaling('call:reject', {
          callId: payload.callId,
          institutionId: payload.institutionId,
          student: payload.student,
          reason: 'ব্যবহারকারী অন্য কলে ব্যস্ত আছেন।',
        });
        return;
      } else {
        console.log('[VoiceCall] Previous call state was not an active connected call. Cleaning up stale state for new incoming call:', payload.callId);
        this.cleanup();
      }
    }

    this.isCaller = false;
    this.currentRingingCallId = payload.callId;

    // Immediately join the dedicated call room channel so signaling is 100% direct!
    this.subscribeCallRoom(payload.callId);

    // Ensure institutionName is filled
    if (!payload.institutionName && !payload.caller?.institutionName) {
      if (this.cachedInstitutionName) {
        payload.institutionName = this.cachedInstitutionName;
        if (payload.caller) payload.caller.institutionName = this.cachedInstitutionName;
      }
    }

    this.activeCallData = payload;

    // Check if this incoming call was already marked for auto-answer (via ?answer=1 or handleNativeCallAction('answer'))
    const isAutoAnswerPending = Boolean(
      this.pendingAutoAnswerCallId &&
      (this.pendingAutoAnswerCallId === '__ANY__' || this.pendingAutoAnswerCallId === payload.callId)
    );

    if (isAutoAnswerPending) {
      console.log('[VoiceCall] Incoming offer matched pending auto-answer! Auto-accepting immediately without ringing modal:', payload.callId);
      this.setPendingAutoAnswer(null);
      if (typeof window !== 'undefined' && window.AndroidInterface?.stopRinging) {
        try { window.AndroidInterface.stopRinging(); } catch {}
      }
      await this.acceptCall();
      return;
    }

    // Format clean caller name for notification & native bridge (avoiding raw email strings)
    const rawCaller = payload.institutionName || payload.caller?.institutionName || payload.caller?.name || '';
    const cleanCallerName = (rawCaller.includes('@') || rawCaller.toLowerCase().includes('gmail') || rawCaller.toLowerCase().includes('.com'))
      ? (payload.institutionName || payload.caller?.institutionName || 'Institution Admin')
      : (rawCaller || 'Institution Admin');
    const callerName = cleanCallerName || payload.student?.name || 'Institution Admin';
    const callId = payload.callId;

    const hasNativeBridge = typeof window !== 'undefined' && Boolean(window.AndroidInterface?.onIncomingCall);
    let handledByNativeBridge = false;

    // Trigger Android native incoming call UI via JavaScript bridge if available
    if (hasNativeBridge) {
      try {
        window.AndroidInterface?.onIncomingCall?.(callerName, callId);
        handledByNativeBridge = true;
        this.isNativeBridgeActive = true;
        console.log('[VoiceCall] Native Android incoming call UI triggered via bridge for call:', callId);
      } catch (bridgeErr) {
        console.warn('[VoiceCall] AndroidInterface.onIncomingCall bridge error, falling back to web UI & ringtone:', bridgeErr);
        handledByNativeBridge = false;
        this.isNativeBridgeActive = false;
      }
    }

    // Persist payload for cold start or native retrieval
    try {
      localStorage.setItem('deenora_active_call_payload', JSON.stringify(payload));
      // Only broadcast across tabs if web UI is active (never wake web modal when native bridge handles it)
      if (!handledByNativeBridge && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('deenora_call_events');
        bc.postMessage({ type: 'INCOMING_CALL', payload });
        setTimeout(() => bc.close(), 1000);
      }
    } catch {}

    // If native bridge is not present (desktop/iOS) or bridge invocation failed, use web ringtone & modal
    if (!handledByNativeBridge) {
      this.isNativeBridgeActive = false;
      // Start incoming ringtone
      callSoundService.startIncomingRingtone();
      this.onStatusChange?.('incoming', payload);
      this.onIncomingCall?.(payload);

      // Show WhatsApp-style persistent lock-screen / mobile screen notification
      showIncomingCallNotification({
        callId: payload.callId,
        callerName: cleanCallerName,
        studentName: payload.student.name,
        photoUrl: payload.student.photo_url,
      });

      // Auto-timeout incoming call after 50 seconds on web ONLY if native bridge is not handling it
      if (this.incomingRingTimeout) {
        clearTimeout(this.incomingRingTimeout);
        this.incomingRingTimeout = null;
      }
      this.incomingRingTimeout = setTimeout(() => {
        if (this.activeCallData && this.activeCallData.callId === payload.callId && !this.isCallAnswered) {
          console.log('[VoiceCall] Callee incoming call unanswered timeout (50s), cleaning up');
          this.rejectCall('কলের কোনো উত্তর দেওয়া হয়নি (টাইমআউট)।', payload.callId, true);
        }
      }, 50000);
    } else {
      // In native bridge mode, web stays passive:
      // Offer state is preserved in this.activeCallData and localStorage.
      // Do NOT start incomingRingTimeout or send reject!
      // Native Android UI manages ringtone, UI dismiss, and user actions.
      // Long-term fail-safe timer (90s): only cleans up local state silently if native never responds
      if (this.incomingRingTimeout) {
        clearTimeout(this.incomingRingTimeout);
        this.incomingRingTimeout = null;
      }
      this.incomingRingTimeout = setTimeout(() => {
        if (this.activeCallData && this.activeCallData.callId === payload.callId && !this.isCallAnswered) {
          console.log('[VoiceCall] Passive native bridge safety timeout (90s) expired. Silently clearing local state without sending reject.');
          this.cleanup();
        }
      }, 90000);
    }

    // Notify caller that phone is ringing
    this.broadcastSignaling('call:ringing', {
      callId: payload.callId,
      institutionId: payload.institutionId,
      calleeId: this.currentUserId,
    });
  }

  /**
   * Accept incoming call
   */
  public async acceptCall(): Promise<boolean> {
    if (!this.activeCallData || !this.activeCallData.offer) {
      const stored = this.getActiveCall();
      if (stored && stored.offer) {
        this.activeCallData = stored;
      } else {
        return false;
      }
    }

    try {
      if (this.incomingRingTimeout) {
        clearTimeout(this.incomingRingTimeout);
        this.incomingRingTimeout = null;
      }
      this.setPendingAutoAnswer(null);
      callSoundService.stopAll();
      dismissIncomingCallNotification();
      if (typeof window !== 'undefined' && window.AndroidInterface?.stopRinging) {
        try { window.AndroidInterface.stopRinging(); } catch {}
      }
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
        institutionId: this.activeCallData.institutionId,
        student: this.activeCallData.student,
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        calleeName: this.activeCallData.student.guardian_name || 'অভিভাবক',
        timestamp: Date.now(),
      });

      this.isCallAnswered = true;
      this.isNativeBridgeActive = false;
      this.currentRingingCallId = null;
      this.onStatusChange?.('connected', this.activeCallData);
      callSoundService.playConnectChime();
      if (typeof window !== 'undefined' && window.AndroidInterface?.callStarted) {
        try { window.AndroidInterface.callStarted(); } catch {}
      }
      this.startHeartbeatAndWatchdog();
      return true;
    } catch (error: any) {
      console.error('[VoiceCall] Error accepting call:', error);
      callSoundService.stopAll();
      this.rejectCall('কল রিসিভ করতে সমস্যা হয়েছে।', undefined, true);
      return false;
    }
  }

  /**
   * Caller receives remote answer
   */
  private async handleRemoteAnswer(payload: CallPayload) {
    if (!this.peerConnection || !payload.answer) return;

    try {
      this.isCallAnswered = true;
      this.isNativeBridgeActive = false;
      this.currentRingingCallId = null;
      callSoundService.stopAll();
      if (this.outgoingRingTimeout) {
        clearTimeout(this.outgoingRingTimeout);
        this.outgoingRingTimeout = null;
      }
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
      this.startHeartbeatAndWatchdog();
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
  public async rejectCall(
    reason: string = 'কলটি কেটে দেওয়া হয়েছে।',
    specificCallId?: string,
    isExplicitUserAction: boolean = false
  ) {
    // 5.3 Guard: If native bridge is active, web must NEVER send automatic reject signals to caller.
    // Only send reject if action was explicitly initiated by user/native action.
    if (this.isNativeBridgeActive && !isExplicitUserAction) {
      console.warn('[VoiceCall] Native bridge is active. Suppressing automatic web reject signal so Admin call is not cut off.');
      this.cleanup();
      return;
    }

    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();

    // 1. Immediately reflect UI state on the user's screen
    this.onStatusChange?.('rejected', this.activeCallData || undefined);

    const callData = this.activeCallData || this.getActiveCall();
    const effectiveCallId = specificCallId || callData?.callId;

    if (effectiveCallId) {
      const payload: any = {
        callId: effectiveCallId,
        institutionId: callData?.institutionId || this.currentInstitutionId || '',
        student: callData?.student,
        calleePhone: callData?.calleePhone || callData?.student?.guardian_phone || this.currentPhone,
        caller: callData?.caller,
        reason,
        timestamp: Date.now(),
      };

      // Direct WebRTC DataChannel (instant 0ms)
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'call:reject', ...payload }));
        } catch {}
      }

      // Broadcast immediately across all room & direct channels
      await this.broadcastSignaling('call:reject', payload);

      // Repeat burst pulse after 60ms and 150ms to guarantee delivery across sockets
      setTimeout(() => {
        this.broadcastSignaling('call:reject', payload).catch(() => {});
      }, 60);
      setTimeout(() => {
        this.broadcastSignaling('call:reject', payload).catch(() => {});
      }, 150);

      // Cross-tab broadcast
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('deenora_call_events');
          bc.postMessage({ type: 'CALL_REJECTED', payload });
          setTimeout(() => bc.close(), 1000);
        }
      } catch {}

      // Safe buffer so socket packets leave the browser before channel teardown
      await new Promise((r) => setTimeout(r, 650));
    }

    this.cleanup();
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
  public async endCall() {
    callSoundService.stopAll();
    dismissIncomingCallNotification();
    callSoundService.playDisconnectChime();

    // TASK 4b: If caller cancels/ends call before callee answered, send cancel_call_push
    if (this.isCaller && !this.isCallAnswered && this.activeCallData) {
      const callData = this.activeCallData;
      fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_call_push',
          call_id: callData.callId,
          callee_phone: callData.student?.guardian_phone || callData.calleePhone,
          student_id: callData.student?.id,
          institution_id: callData.institutionId,
        }),
      }).catch(() => {});
    }

    // 1. Immediately reflect UI state on the user's screen
    this.onStatusChange?.('ended', this.activeCallData || undefined);

    const callData = this.activeCallData;
    if (callData) {
      const payload = {
        callId: callData.callId,
        institutionId: callData.institutionId,
        student: callData.student,
        calleePhone: callData.calleePhone || callData.student?.guardian_phone,
        caller: callData.caller,
        reason: 'কল সমাপ্ত হয়েছে।',
        timestamp: Date.now(),
      };

      // Direct WebRTC DataChannel (instant 0ms)
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'call:end', ...payload }));
        } catch {}
      }

      // Broadcast immediately across room & direct channels
      await this.broadcastSignaling('call:end', payload);

      // Repeat burst pulse after 60ms
      setTimeout(() => {
        this.broadcastSignaling('call:end', payload).catch(() => {});
      }, 60);

      // Cross-tab broadcast
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('deenora_call_events');
          bc.postMessage({ type: 'CALL_ENDED', payload });
          setTimeout(() => bc.close(), 1000);
        }
      } catch {}

      // Safe buffer so socket packets leave the browser before channel teardown
      await new Promise((r) => setTimeout(r, 350));
    }

    this.cleanup();
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
   * Cleanup connections, channels and media tracks
   */
  private cleanup() {
    dismissIncomingCallNotification();
    callSoundService.stopAll();

    // Reset native Android call/ringing UI if native bridge is active
    if (typeof window !== 'undefined' && window.AndroidInterface) {
      try {
        window.AndroidInterface.stopRinging?.();
        window.AndroidInterface.callEnded?.();
      } catch {}
    }

    if (this.outgoingRingTimeout) {
      clearTimeout(this.outgoingRingTimeout);
      this.outgoingRingTimeout = null;
    }
    if (this.incomingRingTimeout) {
      clearTimeout(this.incomingRingTimeout);
      this.incomingRingTimeout = null;
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    try {
      localStorage.removeItem('deenora_active_call_payload');
    } catch {}

    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }

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

    if (this.callRoomChannel) {
      try { supabase.removeChannel(this.callRoomChannel); } catch {}
      this.callRoomChannel = null;
    }

    if (this.callerExtraChannels && this.callerExtraChannels.length > 0) {
      this.callerExtraChannels.forEach((ch) => {
        try { supabase.removeChannel(ch); } catch {}
      });
      this.callerExtraChannels = [];
    }

    // Completely reset all call session state so subsequent calls are never blocked
    this.activeCallData = null;
    this.isCaller = false;
    this.isCallAnswered = false;
    this.pendingCandidates = [];
    this.pendingAutoAnswerCallId = null;
    this.isNativeBridgeActive = false;
    this.currentRingingCallId = null;
    if (this.autoAnswerTimer) {
      clearTimeout(this.autoAnswerTimer);
      this.autoAnswerTimer = null;
    }

    // Verify and ensure realtime signaling channels are active and subscribed for the next call!
    setTimeout(() => {
      this.checkConnectionHealth(false);
    }, 250);
  }

  /**
   * Full destruction
   */
  public destroy() {
    dismissIncomingCallNotification();
    this.cleanup();
    callSoundService.stopAll();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (typeof window !== 'undefined') {
      if (this.handleUnload) {
        window.removeEventListener('beforeunload', this.handleUnload);
        window.removeEventListener('pagehide', this.handleUnload);
      }
      if (this.handleVisibilityChange && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      }
      if (this.handleOnline) {
        window.removeEventListener('online', this.handleOnline);
      }
    }

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
    if (this.userChannel) {
      try { supabase.removeChannel(this.userChannel); } catch {}
      this.userChannel = null;
    }
    this.isSubscribed = false;
  }
}

export const voiceCallService = new VoiceCallService();

// Expose global bridge function window.handleNativeCallAction for Android WebView & Notifications
if (typeof window !== 'undefined') {
  (window as any).handleNativeCallAction = (action: string, callId?: string) => {
    return voiceCallService.handleNativeAction(action, callId);
  };
  (window as any).onNativeCallAction = (window as any).handleNativeCallAction;

  // Auto-detect ?answer=1&call_id=xxx on page load (fresh start case)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('answer') === '1') {
      const targetCallId = params.get('call_id') || '__ANY__';
      console.log('[VoiceCall] Page load detected ?answer=1 for call_id:', targetCallId);
      voiceCallService.setPendingAutoAnswer(targetCallId);
      if (targetCallId && targetCallId !== '__ANY__') {
        voiceCallService.subscribeCallRoom(targetCallId);
        voiceCallService.requestOffer(targetCallId);
      }
    }
  } catch {}
}
