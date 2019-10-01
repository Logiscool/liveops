import {
    ReducerQueue,
    ActionEmitter,
    ActionDispatcher,
    ActionWithSubscription,
    ReducerQueueItem,
    BrokerConfiguration, AnyPayload
} from "../";

const debug = require('debug')('logiscool-liveops:reducer-processor');

export type ActionWithFollowUp<TPayload = AnyPayload> = ActionWithSubscription<TPayload> & ActionFollowUp;
export type ActionFollowUp = {
    next?: ActionWithFollowUp,
    revert?: ActionWithFollowUp,
    reverting?: boolean
};

export type ActionReducer = (
    client: string | null, action: ActionWithFollowUp, emitter: ActionEmitter) => Promise<boolean>;

export class ReducerQueueProcessor {
    readonly emitter: ActionEmitter;
    readonly dispatcher: ActionDispatcher;
    readonly queue: ReducerQueue;
    readonly segment?: string;

    reduce: ActionReducer;

    private shouldStop = false;
    queueInterval = 100;

    constructor(queue: ReducerQueue, brokerConfig: BrokerConfiguration, segment?: string) {
        this.queue = queue;
        this.segment = segment;
        this.emitter = new ActionEmitter(brokerConfig)
    }

    private processItem = async (item: ReducerQueueItem) => {
        const { action, client, resolve, reject } = item;

        try {
            await this.reduce(client, action, this.emitter);
            resolve()
        }
        catch(e) {
            debug('failed to execute reducer', e);
            reject(e)
        }
    };

    start() {
        const processQueue = async () => {
            if(this.shouldStop) return;

            let items = await this.queue.getNextForAll();
            await Promise.all(items.map(this.processItem));
            setTimeout(processQueue, this.queueInterval)
        };

        processQueue()
    }

    stop() {
        this.shouldStop = true
    }
}