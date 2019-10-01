import {
    ActionTrigger,
    TriggerQueueProcessor,
    IActionEmitter,
    ActionDispatcher,
    AnyPayload
} from "../";

const debug = require('debug')('logiscool-liveops:trigger');

export type TriggerHandler<TPayload = AnyPayload> =
    (params: { client: any, payload: TPayload, emitter: IActionEmitter, dispatcher: ActionDispatcher, session: string, context: { public: any, private: any } })
        => Promise<any>;

export class TriggerManager {

    constructor(processor: TriggerQueueProcessor) {
        processor.trigger = this.actionTrigger
    }

    private readonly triggers: Record<string, TriggerHandler[]> = {};

    private actionTrigger: ActionTrigger = async (client, action, emitter, dispatcher) => {
        const { type, payload, session, context = { public: {}, private: {} } } = action;
        debug('ActionTrigger', client, type);

        const handlers = this.triggers[type.toString()];
        if(handlers) {
            await Promise.all(handlers.map(handler => handler({
                client, payload,
                emitter,
                dispatcher,
                context,
                session: session || ''
            })))
        }
    };

    trigger(type: string, handler: TriggerHandler) {
        (this.triggers[type] || (this.triggers[type] = [])).push(handler);
        return this
    }
}