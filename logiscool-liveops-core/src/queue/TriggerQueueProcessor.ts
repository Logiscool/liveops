import {
    ActionEmitter,
    ActionDispatcher,
    BrokerConfiguration
} from "../";
import {ActionWithFollowUp} from "./ReducerQueueProcessor";
import {SharedStoreQueueItem} from "redux-socket-server";
import {TriggerQueue} from "./TriggerQueue";

const debug = require('debug')('logiscool-liveops:trigger-processor');

export type ActionTrigger = (
    client: string | null, action: ActionWithFollowUp, emitter: ActionEmitter, dispatcher: ActionDispatcher) => void;

export class TriggerQueueProcessor {
    readonly emitter: ActionEmitter;
    readonly dispatcher: ActionDispatcher;
    readonly triggerQueue: TriggerQueue;
    readonly segment: string|null;

    trigger: ActionTrigger;

    private shouldStop = false;
    queueInterval = 100;

    constructor(queue: TriggerQueue, brokerConfig: BrokerConfiguration, segment: string | null = null) {
        this.triggerQueue = queue;
        this.emitter = new ActionEmitter(brokerConfig);
        this.dispatcher = new ActionDispatcher(brokerConfig);
        this.segment = segment
    }

    private processItem = async (item: SharedStoreQueueItem) => {
        const { action, client } = item;

        try {
            this.trigger(client, action, this.emitter, this.dispatcher)
        }
        catch(e) {
            debug('failed to process trigger', e);
            debug(e)
        }
    };

    start() {
        const processQueue = async () => {
            if(this.shouldStop) return;

            let item = await this.triggerQueue.getNext(this.segment);
            while(item) {
                await this.processItem(item);
                item = await this.triggerQueue.getNext(this.segment);
            }

            setTimeout(processQueue, this.queueInterval)
        };

        processQueue()
    }

    stop() {
        this.shouldStop = true
    }
}