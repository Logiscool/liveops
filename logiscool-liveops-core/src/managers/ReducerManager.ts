import {
    ActionReducer,
    ReducerQueueProcessor,
    setTransaction,
    IActionEmitter,
    TransactionStore,
    ActionWithFollowUp,
    BrokerConfiguration,
    ActionTriggerer,
    ActionDispatcher,
    LiveOpsActionInfo,
    ActionMappingSet,
    AnyPayload, LiveOpsActionType
} from "../";

const debug = require('debug')('logiscool-liveops:reducer');

export type Reducer<TPayload = AnyPayload> = (params: {
    client: any, payload: TPayload, emitter: IActionEmitter, session: string, context: { public: any, private: any }
}) => Promise<ActionWithFollowUp|boolean|void>;

export class ReducerManager {

    constructor(processor: ReducerQueueProcessor, brokerConfig: BrokerConfiguration, channelMapping: ActionMappingSet,
                tryGetActionInfo: (name: string|LiveOpsActionType) => LiveOpsActionInfo) {
        processor.reduce = this.reduce;
        this.triggerer = new ActionTriggerer(brokerConfig, processor.segment);
        this.dispatcher = new ActionDispatcher(brokerConfig);
        this.transactionStore = new TransactionStore(processor.queue.redis, processor.queue.prefix);
        this.channelMapping = channelMapping;
        this.tryGetActionInfo = tryGetActionInfo
    }

    private readonly tryGetActionInfo: (name: string|LiveOpsActionType) => LiveOpsActionInfo;
    private channelMapping: ActionMappingSet;
    private dispatcher: ActionDispatcher;
    private triggerer: ActionTriggerer;
    private transactionStore: TransactionStore;
    private reducers: Record<string, Reducer> = {};

    private reduce: ActionReducer = async (client, action, emitter) => {
        let { type, payload, next, reverting, session, context = { public: {}, private: {} }, status } = action;
        debug('ActionReducer', client, type);

        const actionInfo = this.tryGetActionInfo(type);

        const channel = this.channelMapping.tryApply(action);
        if(channel) {
            action.channel = channel;

            if (session) {
                if (action.subscribe || actionInfo.autoChannelJoin) {
                    await this.dispatcher.joinChannel(session, channel)
                } else if (action.unsubscribe || actionInfo.autoChannelLeave) {
                    await this.dispatcher.leaveChannel(session, channel)
                }
            }
        }

        const handler = status ? undefined : this.reducers[type.toString()];
        const result = handler
            ? await handler({
                client, payload, context, emitter,
                session: session || ''
            })
            : undefined;

        if (status) {
            this.triggerer.triggerClient(client, action)
        }

        if (reverting) {
            await this.revert(action, emitter)
        }
        else {
            const realResult: any = typeof result === 'undefined' || result;

            if (realResult) {
                next = typeof realResult == 'boolean' ? next : realResult;
                if (next) {
                    await this.transactionStore.completeAction(action);
                    setTransaction(next, action);
                    next.context = context;
                    await emitter.enqueue(next)
                }
                else {
                    const actions = await this.transactionStore.completeTransaction(action);
                    debug('completed transaction, triggering:', actions.map(action => action.type));
                    await Promise.all(
                        actions.filter(action => !action.status)
                            .map(action => this.triggerer.trigger(action))
                    )
                }
            }
            else {
                await this.revert(action, emitter)
            }

            return !!realResult
        }

        return true
    };

    private async revert(action: ActionWithFollowUp, emitter: IActionEmitter) {
        const prevAction = await this.transactionStore.revertAction(action);
        if (prevAction) {
            prevAction.context = action.context;
            emitter.enqueue(prevAction)
        }
    }

    reducer(type: string, handler: Reducer) {
        this.reducers[type] = handler;
        return this
    }
}