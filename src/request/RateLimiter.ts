import { LeakyBucket } from "./LeakyBucket";

export class RateLimiter {
    private buckets: Map<string, LeakyBucket> = new Map();
    private readonly defaultCapacity = 100;
    private readonly defaultRefillRate = 10; // 10 tokens per second

    public checkLimit(userId: string, cost: number): boolean {
        if (!this.buckets.has(userId)) {
            this.buckets.set(userId, new LeakyBucket(this.defaultCapacity, this.defaultRefillRate));
        }

        const bucket = this.buckets.get(userId)!;
        return bucket.consume(cost);
    }

    public cleanup() {
        // Clean up buckets for disconnected users
        const cutoff = Date.now() - 300000; // 5 minutes

        for (const [userId, bucket] of this.buckets.entries()) {
            if (bucket.getTokens() >= this.defaultCapacity) {
                this.buckets.delete(userId);
            }
        }
    }
}
