export class DualRateLimiter {
  private rpm: number;
  private tpm: number;
  private requestTimes: number[] = [];
  private tokenEvents: { time: number; tokens: number }[] = [];
  private tokenTotal = 0;

  constructor(rpm: number, tpm: number) {
    this.rpm = Math.max(1, rpm);
    this.tpm = Math.max(1, tpm);
  }

  async acquire(tokens: number): Promise<void> {
    tokens = Math.max(1, tokens);

    const waitTime = this.calculateWait(tokens);
    if (waitTime > 0) {
      await sleep(waitTime);
    }

    const now = Date.now() / 1000;
    this.record(now, tokens);
  }

  private calculateWait(tokens: number): number {
    const now = Date.now() / 1000;

    // Clean expired entries (>60s old)
    while (this.requestTimes.length > 0 && now - this.requestTimes[0] >= 60) {
      this.requestTimes.shift();
    }
    while (this.tokenEvents.length > 0 && now - this.tokenEvents[0].time >= 60) {
      this.tokenTotal -= this.tokenEvents.shift()!.tokens;
    }

    let waitReq = 0;
    if (this.requestTimes.length >= this.rpm) {
      waitReq = 60 - (now - this.requestTimes[0]) + 0.05; // small buffer
    }

    let waitTok = 0;
    if (this.tokenTotal + tokens > this.tpm && this.tokenEvents.length > 0) {
      waitTok = 60 - (now - this.tokenEvents[0].time) + 0.05;
    }

    return Math.max(waitReq, waitTok, 0);
  }

  private record(now: number, tokens: number): void {
    this.requestTimes.push(now);
    this.tokenEvents.push({ time: now, tokens });
    this.tokenTotal += tokens;
  }
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}