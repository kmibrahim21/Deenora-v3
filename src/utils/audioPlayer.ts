/**
 * Universal Audio Player with Web Audio API decoding and HTML5 Audio fallback.
 * Designed to play 8kHz/16kHz WAV, MP3, AAC, and telephony voice broadcasts
 * flawlessly across all desktop and mobile browsers (including Android/iOS WebViews).
 */

class UniversalAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentId: string | null = null;
  private isPlayingState: boolean = false;
  private onEndCallbacks: Map<string, () => void> = new Map();
  private bufferCache: Map<string, AudioBuffer> = new Map();

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  public getProxiedUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // Return original URL directly, completely bypassing /api/proxy-audio
    // to save massive Vercel Fast Origin Transfer bandwidth and proxy overhead.
    return trimmed;
  }

  public async play(
    id: string,
    rawUrl: string,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): Promise<void> {
    this.stop();

    if (!rawUrl) {
      if (onError) onError(new Error('Audio URL is empty'));
      return;
    }

    this.currentId = id;
    this.isPlayingState = true;
    if (onEnd) this.onEndCallbacks.set(id, onEnd);

    const proxiedUrl = this.getProxiedUrl(rawUrl);

    // Method 1: Try Web Audio API (Best for 8kHz WAV, Mobile WebViews, & zero CORS glitches)
    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        let audioBuffer = this.bufferCache.get(rawUrl) || this.bufferCache.get(proxiedUrl);
        if (!audioBuffer) {
          let res: Response | null = null;
          try {
            res = await fetch(proxiedUrl);
          } catch (e) {
            console.warn('Proxy fetch failed, attempting direct fetch:', e);
          }

          if (!res || !res.ok) {
            // Direct fallback
            res = await fetch(rawUrl).catch(() => null);
          }

          if (res && res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
              ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
            });
            this.bufferCache.set(rawUrl, audioBuffer);
          }
        }

        if (audioBuffer && this.currentId === id) {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => {
            if (this.currentId === id) {
              this.isPlayingState = false;
              this.currentId = null;
              this.currentSource = null;
              const cb = this.onEndCallbacks.get(id);
              if (cb) cb();
            }
          };
          source.start(0);
          this.currentSource = source;
          return;
        }
      } catch (webAudioErr) {
        console.warn('Web Audio API decode/play error, falling back to HTML5 Audio:', webAudioErr);
      }
    }

    // Method 2: Fallback to HTML5 Audio Element
    try {
      const audio = new Audio();
      // Only set crossOrigin if the URL is local/proxied, otherwise do not set it to allow CORS-free play of external media.
      if (typeof window !== 'undefined' && (proxiedUrl.startsWith('/') || proxiedUrl.includes(window.location.hostname))) {
        audio.crossOrigin = 'anonymous';
      }
      audio.src = proxiedUrl;
      this.currentAudioElement = audio;

      audio.onended = () => {
        if (this.currentId === id) {
          this.isPlayingState = false;
          this.currentId = null;
          this.currentAudioElement = null;
          const cb = this.onEndCallbacks.get(id);
          if (cb) cb();
        }
      };

      audio.onerror = (e) => {
        if (this.currentAudioElement !== audio || !this.isPlayingState) {
          return; // Ignore errors if we stopped or are no longer playing this element
        }
        console.warn('HTML5 Audio error on proxied URL, trying direct URL:', e);
        // Try direct URL fallback
        if (audio.src !== rawUrl) {
          audio.src = rawUrl;
          audio.play().catch(finalErr => {
            this.stop();
            if (onError) onError(finalErr);
          });
        } else {
          this.stop();
          if (onError) onError(new Error('Audio playback failed'));
        }
      };

      await audio.play();
    } catch (html5Err: any) {
      console.error('All audio playback methods failed:', html5Err);
      this.stop();
      if (onError) onError(html5Err);
    }
  }

  public stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {}
      this.currentSource = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.src = '';
      } catch (e) {}
      this.currentAudioElement = null;
    }

    this.isPlayingState = false;
    this.currentId = null;
  }

  public toggle(
    id: string,
    rawUrl: string,
    onStateChange: (isPlaying: boolean) => void,
    onError?: (err: any) => void
  ): void {
    if (this.currentId === id && this.isPlayingState) {
      this.stop();
      onStateChange(false);
    } else {
      onStateChange(true);
      this.play(
        id,
        rawUrl,
        () => onStateChange(false),
        (err) => {
          onStateChange(false);
          if (onError) onError(err);
        }
      );
    }
  }

  public isPlaying(id?: string): boolean {
    if (id) {
      return this.isPlayingState && this.currentId === id;
    }
    return this.isPlayingState;
  }

  public getCurrentId(): string | null {
    return this.currentId;
  }
}

export const globalAudioPlayer = new UniversalAudioPlayer();
