//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
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
