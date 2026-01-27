
class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playShoot() {
    this.playTone(440, 'sine', 0.1, 0.1);
  }

  playExplosion() {
    this.playTone(100, 'sawtooth', 0.3, 0.2);
  }

  playBuild() {
    this.playTone(660, 'triangle', 0.15, 0.1);
  }

  playHurt() {
    this.playTone(150, 'square', 0.2, 0.15);
  }

  playCoin() {
    this.playTone(880, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(1100, 'sine', 0.1, 0.1), 50);
  }
}

export const audioService = new AudioService();
