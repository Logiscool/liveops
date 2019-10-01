import {SharedStoreAction, SharedStoreQueueItem} from "redux-socket-server";
import {RedisClient} from "redis";
import {EventEmitter} from "events";

const debug = require('debug')('logiscool-liveops:trigger-queue');

export class TriggerQueue extends EventEmitter  {
    readonly redis: RedisClient;
    readonly prefix: string;

    constructor(redisPub: RedisClient, prefix: string = '') {
        super();

        this.prefix = prefix;
        this.redis = redisPub
    }

    private key(segment: string | null = null) {
        return `${this.prefix}${segment ? `:${segment}` : ''}:trigger-queue`
    }

    enqueue(client: string|null, action: SharedStoreAction, segment: string | null = null) {
        return new Promise<void>((resolve, reject) => {
            this.redis.lpush(this.key(segment), JSON.stringify({client, action}), (err) => {
                if (err) {
                    debug(`[${this.key(segment)}] failed to enqueue`);
                    return reject(err)
                }
                resolve();

                debug(`[${this.key(segment)}] enqueued action: ${action.type} (${client || 'no client'})`)
            })
        })
    }

    private dequeueForKey = (key: string): Promise<SharedStoreQueueItem|undefined> => {
        return new Promise(async (resolve, reject) => {
            this.redis.rpop(key, (err, rawData) => {
                if (err) {
                    debug(`[${key}] failed to get next`);
                    return reject(err)
                }

                const data = rawData ? JSON.parse(rawData) : undefined;
                resolve(data);

                if(data) {
                    debug(`[${key}] received action: ${data.action.type} (${data.client || 'no client'})`)
                }
            })
        })
    };

    async getNext(segment: string | null = null) {
        return this.dequeueForKey(this.key(segment))
    }

    async clean() {
        this.redis.del(`${this.prefix}:trigger-queue`);
        this.redis.del(`${this.prefix}:*:trigger-queue`);
        debug(`[${this.key()}] cleanup done`)
    }
}