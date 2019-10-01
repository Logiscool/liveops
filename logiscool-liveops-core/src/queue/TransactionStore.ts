import {RedisClient} from "redis";
import {ActionWithFollowUp, setTransaction} from "..";

const debug = require('debug')('logiscool-liveops:transaction');

export class TransactionStore  {
    private readonly redis: RedisClient;
    private readonly prefix: string;

    constructor(redisPub: RedisClient, prefix: string = '') {
        this.prefix = prefix;
        this.redis = redisPub
    }

    private transaction(action: ActionWithFollowUp) {
        if(action.meta) {
            return `${this.prefix}:transaction:${action.meta.transaction}`
        }
        return null
    }

    completeAction(action: ActionWithFollowUp) {
        return new Promise<void>((resolve, reject) => {
            const key = this.transaction(action);
            if(!key) return resolve();

            this.redis.lpush(key, JSON.stringify(action), (err) => {
                if (err) {
                    debug(`[${key}] failed to enqueue transaction entry`);
                    return reject(err)
                }
                resolve();

                debug(`[${key}] enqueued transaction entry: ${action.type}`)
            })
        })
    }

    completeTransaction(action: ActionWithFollowUp) {
        return new Promise<ActionWithFollowUp[]>((resolve, reject) => {
            const key = this.transaction(action);
            if(!key) return resolve([ action ]);

            this.redis.lrange(key, 0, -1, (err, items) => {
                if (err) {
                    debug(`[${key}] failed to dequeue transaction entries`);
                    return reject(err)
                }

                const data = items.map(item => JSON.parse(item));
                data.push(action);
                resolve(data);

                debug(`[${key}] completed transaction`);

                this.redis.del(key, (err) => {
                    if (err) {
                        debug(`[${key}] failed to delete completed transaction`);
                        return reject(err)
                    }
                })
            })
        })
    }

    revertAction(action: ActionWithFollowUp): Promise<ActionWithFollowUp|undefined> {
        return new Promise(async (resolve, reject) => {
            const key = this.transaction(action);
            if(!key) return resolve();

            this.redis.lpop(key, (err, rawData) => {
                if (err) {
                    debug(`[${key}] failed to get next transaction entry`);
                    return reject(err)
                }

                let revertAction = rawData ? JSON.parse(rawData) : undefined;
                if(revertAction) {
                    if(revertAction.revert) {
                        revertAction = revertAction.revert;
                        revertAction.reverting = true;
                        setTransaction(revertAction, action);

                        debug(`[${key}] reverted transaction entry: ${action.type}`)
                    }
                    else {
                        return this.revertAction(revertAction)
                            .then(resolve)
                            .catch(reject)
                    }
                }
                resolve(revertAction)
            })
        })
    }

    async clean() {
        this.redis.del(this.prefix + ':transaction:*');

        debug(`[${this.prefix}] cleanup done`)
    }
}