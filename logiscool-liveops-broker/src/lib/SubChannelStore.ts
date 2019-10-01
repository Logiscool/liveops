import {RedisClient} from "redis";
const debug = require('debug')('logiscool-liveops:sub-channel');

export class SubChannelStore  {
    private readonly redis: RedisClient;
    private readonly prefix: string;

    constructor(redisPub: RedisClient, prefix: string = '') {
        this.prefix = prefix;
        this.redis = redisPub
    }

    private key(channel: string) {
        return `${this.prefix}:sub-channels:${channel}`
    }

    addSubChannel(channel: string, subChannel: string) {
        return new Promise<void>((resolve, reject) => {
            channel = this.key(channel);
            this.redis.sadd(channel, subChannel, (err, count) => {
                if (err) {
                    debug(`[${channel}] failed add sub-channel`);
                    return reject(err)
                }
                resolve();

                if(count) debug(`[${channel}] added sub-channel: ${channel}`)
            })
        })
    }

    removeSubChannel(channel: string, subChannel: string) {
        return new Promise<void>((resolve, reject) => {
            channel = this.key(channel);
            this.redis.srem(channel, subChannel, (err, count) => {
                if (err) {
                    debug(`[${channel}] failed remove sub-channel`);
                    return reject(err)
                }
                resolve();

                if(count) debug(`[${channel}] removed sub-channel: ${channel}`)
            })
        })
    }

    deleteChannel(channel: string) {
        return new Promise<void>((resolve, reject) => {
            channel = this.key(channel);
            this.redis.del(channel, (err) => {
                if (err) {
                    debug(`[${channel}] failed remove channel`);
                    return reject(err)
                }
                resolve();

                debug(`[${channel}] removed channel`)
            })
        })
    }

    getSubChannels(channel: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            channel = this.key(channel);
            this.redis.smembers(channel, (err, subChannels) => {
                if (err) {
                    debug(`[${channel}] failed to get sub-channels`);
                    return reject(err)
                }

                resolve(subChannels)
            })
        })
    }

    async clean() {
        this.redis.del(this.prefix + ':sub-channels:*');

        debug(`[${this.prefix}] cleanup done`)
    }
}