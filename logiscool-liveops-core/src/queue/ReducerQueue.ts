import {SharedStoreAction} from "redux-socket-server";
import {RedisClient} from "redis";
import {EventEmitter} from "events";

const debug = require('debug')('logiscool-liveops:reducer-queue');

export interface ReducerQueueItem {
    client: string|null
    action: SharedStoreAction
    resolve: () => void
    reject: (e: Error) => void
}

function hashFunc(str: string, max: number) {
    let hash = 0;
    for (let letter of str) {
        hash = (hash << 5) + letter.charCodeAt(0);
        hash = (hash & hash) % max
    }
    return hash
}

export class ReducerQueue extends EventEmitter  {
    readonly redis: RedisClient;
    readonly prefix: string;

    private keys: string[] = [];

    lockTTL = 1000;
    bucketCount = 256;

    constructor(redisPub: RedisClient, prefix: string = '') {
        super();

        this.prefix = prefix;
        this.redis = redisPub
    }

    private hash(resource: string | null, segment: string|null = null) {
        return `${this.prefix}${segment ? `:${segment}` : ''}:bucket-queue:${hashFunc(resource || '@', this.bucketCount)}`
    }

    async allocateBuckets(partition: number[], segment: string|null = null) {
        debug('allocating buckets', `[${partition[0]}..${partition[partition.length-1]}]`);
        this.keys = partition.map(bucket => `${this.prefix}${segment ? `:${segment}` : ''}:bucket-queue:${bucket}`)
    }

    enqueue(client: string | null, action: SharedStoreAction, resource: string, segment: string | null = null) {
        return new Promise<{ segment: string, bucket: number }|true>((resolve, reject) => {
            const hash = this.hash(resource, segment);
            this.redis.lpush(hash, JSON.stringify({client, action}), (err) => {
                if (err) {
                    debug(`[${hash}] failed to enqueue`);
                    return reject(err)
                }

                resolve();
                debug(`[${hash}] enqueued action: ${action.type} (${resource || 'no client'})`)
            })
        })
    }

    private dequeueForKey = (key: string): Promise<ReducerQueueItem|undefined> => {
        return new Promise(async (resolve, reject) => {
            this.redis.rpop(key, (err, rawData) => {
                if (err) {
                    debug(`[${key}] failed to get next`);
                    return reject(err)
                }

                const data = rawData ? JSON.parse(rawData) : undefined;
                resolve(data
                    ? {
                        ...data,
                        resolve: () => {},
                        reject: () => {}
                    }
                    : undefined
                );

                if(data && data.action) {
                    debug(`[${key}] received action: ${data.action.type} (${data.client || 'no client'})`)
                }
            })
        })
    };

    async getNextForAll() {
        const items = await Promise.all(this.keys.map(this.dequeueForKey));
        return items.filter(item => item)
    }

    async clean() {
        this.redis.del(this.prefix + ':bucket-queue:*');
        this.redis.del(this.prefix + ':*:bucket-queue:*');
        debug(`[${this.prefix}] cleanup done`)
    }
}