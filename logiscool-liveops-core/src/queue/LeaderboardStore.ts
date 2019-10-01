import {RedisClient} from "redis";

const debug = require('debug')('logiscool-liveops:leaderboard');

export interface LeaderboardEntry {
    owner: string
    value: number
}

export class LeaderboardStore  {
    private readonly redis: RedisClient;
    private readonly prefix: string;

    constructor(redisPub: RedisClient, prefix: string = '') {
        this.prefix = prefix;
        this.redis = redisPub
    }

    private key(statKey: string) {
        return `${this.prefix}:user-stat:${statKey}`
    }

    incrementStat(statKey: string, owner: string, incrAmount = 1) {
        return new Promise<void>((resolve, reject) => {
            const key = this.key(statKey);
            if(!key) return resolve();

            this.redis.zincrby(key, incrAmount, owner, (err) => {
                if (err) {
                    debug(`[${key}] failed to increment stat`);
                    return reject(err)
                }
                resolve();

                debug(`[${key}] incremented stat of ${owner} by ${incrAmount}`)
            })
        })
    }

    setStat(statKey: string, owner: string, value: number) {
        return new Promise<void>((resolve, reject) => {
            const key = this.key(statKey);
            if(!key) return resolve();

            this.redis.zadd(key, value, owner, (err) => {
                if (err) {
                    debug(`[${key}] failed to set stat`);
                    return reject(err)
                }
                resolve();

                debug(`[${key}] set stat of ${owner} to ${value}`)
            })
        })
    }

    resetStat(statKey: string) {
        return new Promise<void>((resolve, reject) => {
            const key = this.key(statKey);

            this.redis.del(key,(err) => {
                if (err) {
                    debug(`[${key}] failed to reset stat`);
                    return reject(err)
                }
                resolve();

                debug(`[${key}] stat reset`)
            })
        })
    }

    getTopN(statKey: string, n = 10): Promise<LeaderboardEntry[]> {
        return new Promise(async (resolve, reject) => {
            const key = this.key(statKey);

            this.redis.zrevrange(key, 0, n-1,'WITHSCORES', (err, rawData) => {
                if (err) {
                    debug(`[${key}] failed to get top N stat`);
                    return reject(err)
                }

                const data = [];
                for(let i = 0; i < rawData.length; i += 2) {
                    data.push({
                        owner: rawData[i],
                        value: parseInt(rawData[i+1])
                    })
                }

                resolve(data);

                debug(`[${key}] retrieved top ${n}`)
            })
        })
    }

    getRank(statKey: string, owner: string): Promise<number|null> {
        return new Promise(async (resolve, reject) => {
            const key = this.key(statKey);

            this.redis.zrevrank(key, owner, (err, rank) => {
                if (err) {
                    debug(`[${key}] failed to get stat rank`);
                    return reject(err)
                }

                resolve(rank === null ? null : ((rank || 0) + 1));

                debug(`[${key}] retrieved rank for ${owner}: ${rank}`)
            })
        })
    }

    async clean() {
        this.redis.del(this.prefix + ':user-stat:*');

        debug(`[${this.prefix}] cleanup done`)
    }
}