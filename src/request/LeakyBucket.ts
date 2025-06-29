export class LeakyBucket {
    private capacity: number;
    private tokens: number;
    private refillRate: number;
    private lastRefill: number;

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate; // tokens per second
        this.lastRefill = Date.now();
    }

    private refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        const tokensToAdd = timePassed * this.refillRate;

        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    public consume(cost: number): boolean {
        this.refill();

        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }

        return false;
    }

    public getTokens(): number {
        this.refill();
        return this.tokens;
    }
}
