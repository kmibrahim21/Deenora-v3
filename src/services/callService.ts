import { supabase } from '../supabase';
import { callSoundService } from './callSoundService';

export interface CallParticipantInfo {
  id: string;
  name: string;
  role?: string;
  phone?: string;
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
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

export class VoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private channel: any = null;
  private currentInstitutionId: string = '';
  private currentUserId: string = '';
  private activeCallData: CallPayload | null = null;
  private isCaller: boolean = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  // Listeners
  public onStatusChange?: (status: CallStatus, data?: CallPayload) => void;
  public onIncomingCall?: (call: CallPayload) => void;
  public onRemoteStreamReady?: (stream: MediaStream) => void;
  public onError?: (errMessage: string) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudioElement = new Audio();
      this.remoteAudioElement.autoplay = true;
      (this.remoteAudioElement as any).playsInline = true;
    }
  }

  /**
   * Initialize signaling channel for the institution and user
   */
  public initSignaling(institutionId: string, userId: string) {
    if (!institutionId || !userId) return;
    if (this.currentInstitutionId === institutionId && this.currentUserId === userId && this.channel) {
      return;
    }

    this.currentInstitutionId = institutionId;
    this.currentUserId = userId;

    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
    }

    const channelName = `institution-calls-${institutionId}`;
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
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
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[VoiceCall] Realtime Signaling Connected:', channelName);
        }
      });
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
      if (event.candidate && this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'call:candidate',
          payload: {
            callId,
            candidate: event.candidate.toJSON(),
            senderId: this.currentUserId,
            timestamp: Date.now(),
          },
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[VoiceCall] Received remote audio track', event.streams);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.play().catch(() => {});
        }
        this.onRemoteStreamReady?.(remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceCall] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        callSoundService.playConnectChime();
        this.onStatusChange?.('connected', this.activeCallData || undefined);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
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

      // Broadcast via Supabase
      if (this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'call:initiate',
          payload,
        });
      }

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
    // Check if this call is relevant for current user or student
    const isForMe =
      this.currentUserId === payload.student.id ||
      this.currentUserId === payload.calleePhone ||
      (this.currentUserId.startsWith('parent') &&
        (this.currentUserId.includes(payload.student.id) || (payload.calleePhone && this.currentUserId.includes(payload.calleePhone)))) ||
      (payload.caller.id !== this.currentUserId);

    if (!isForMe) return;

    // If already in a call, send busy
    if (this.activeCallData && this.activeCallData.callId !== payload.callId) {
      if (this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'call:reject',
          payload: { callId: payload.callId, reason: 'ব্যবহারকারী অন্য কলে ব্যস্ত আছেন।' },
        });
      }
      return;
    }

    this.isCaller = false;
    this.activeCallData = payload;

    // Start incoming ringtone
    callSoundService.startIncomingRingtone();
    this.onStatusChange?.('incoming', payload);
    this.onIncomingCall?.(payload);

    // Notify caller that phone is ringing
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'call:ringing',
        payload: { callId: payload.callId, calleeId: this.currentUserId },
      });
    }
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

      // Broadcast accept
      if (this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'call:accept',
          payload: {
            callId,
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
            calleeName: this.activeCallData.student.guardian_name || 'অভিভাবক',
            timestamp: Date.now(),
          },
        });
      }

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
    callSoundService.playDisconnectChime();

    if (this.activeCallData && this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'call:reject',
        payload: {
          callId: this.activeCallData.callId,
          reason,
          timestamp: Date.now(),
        },
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
    callSoundService.playDisconnectChime();

    if (this.activeCallData && this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'call:end',
        payload: {
          callId: this.activeCallData.callId,
          timestamp: Date.now(),
        },
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
    this.cleanup();
    callSoundService.stopAll();
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
  }
}

export const voiceCallService = new VoiceCallService();
