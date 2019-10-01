import {ReducerQueue} from "./queue/ReducerQueue";
import {TriggerQueue} from "./queue/TriggerQueue";
import {ReducerQueueProcessor} from "./queue/ReducerQueueProcessor";
import {ActionEmitter, AnyPayload, BrokerConfiguration} from "./action/ActionEmitter";
import {TriggerQueueProcessor} from "./queue/TriggerQueueProcessor";
import {ReducerManager} from "./managers/ReducerManager";
import {TriggerManager} from "./managers/TriggerManager";
import {ActionDispatcher} from "./action/ActionDispatcher";
import {LeaderboardStore} from "./queue/LeaderboardStore";
import {ActionMappingSet} from "./mapping/ActionMappingSet";
import {ServiceInstance} from "./services/ServiceInstance";
import {LiveOpsAction, LiveOpsActionDescriptor, LiveOpsActionInfo, LiveOpsActionType} from "./LiveOpsAction";
import {RedisClient} from "redis";

const debug = require('debug')('logiscool-liveops:service-instance');

export interface LiveOpsServiceFluentResourceProviderOptions {
    extraChannel: string[]|string,
    useAsChannel?: boolean
}

export class LiveOpsServiceFluentResourceProvider {
    private readonly service: LiveOpsService;
    private readonly name: string;
    private readonly options: LiveOpsServiceFluentResourceProviderOptions;

    constructor(service: LiveOpsService, name: string, options?: LiveOpsServiceFluentResourceProviderOptions) {
        this.service = service;
        this.name = name;

        let {extraChannel = [], useAsChannel = true} = options || {};
        extraChannel = Array.isArray(extraChannel) ? extraChannel : [ extraChannel ];
        this.options = {extraChannel, useAsChannel}
    }

    action<TPayload = AnyPayload>(name: LiveOpsActionType<TPayload>|string, descriptor: LiveOpsActionDescriptor<TPayload> = {}) {
        let channel: string|string[]|false|undefined|((action: any) => string[]) = descriptor.channel;
        if(typeof descriptor.channel === "function") {
            //Skip this one
        }
        else if(descriptor.channel || this.options.extraChannel) {
            const originalChannel = descriptor.channel
                ? Array.isArray(descriptor.channel)
                    ? descriptor.channel
                    : [ descriptor.channel ]
                : [];

            channel = [
                ...originalChannel,
                ...this.options.extraChannel
            ];

            if(this.options.useAsChannel) {
                channel.push(this.name)
            }
        }
        else if(this.options.useAsChannel === false) {
            channel = false
        }

        this.service.action(name, {
            ...descriptor,
            resource: this.name,
            channel
        });

        return this
    }

    resource(name: string, options?: LiveOpsServiceFluentResourceProviderOptions) {
        return new LiveOpsServiceFluentResourceProvider(this.service, name, options)
    }

    end() {
        return this.service
    }
}

export const segmentProvider = (type: string) => {
    const typeParts = type.split('/');
    if(typeParts.length >= 3) return typeParts[1].toLowerCase();
    return ''
};

export class LiveOpsService {
    readonly instance: ServiceInstance;
    readonly leaderboardStore: LeaderboardStore;
    readonly dispatcher: ActionDispatcher;
    readonly emitter: ActionEmitter;
    readonly redis: any;
    readonly prefix: any;
    readonly segment: string|undefined;

    private readonly actionLookup: Record<string, LiveOpsAction> = {};
    private readonly actions: LiveOpsAction[] = [];
    private readonly reducerManager: ReducerManager;
    private readonly triggerManager: TriggerManager;
    private readonly reducerProcessor: ReducerQueueProcessor;
    private readonly triggerProcessor: TriggerQueueProcessor;
    private readonly channelMapping: ActionMappingSet;

    constructor(brokerConfig: BrokerConfiguration, prefix: string, redis: RedisClient, redisOut: RedisClient, segment?: string) {
        this.segment = segment;

        this.instance = new ServiceInstance(redisOut, redis, prefix);

        const reducerQueue = new ReducerQueue(redis, prefix);
        const triggerQueue = new TriggerQueue(redis, prefix);
        this.reducerProcessor = new ReducerQueueProcessor(reducerQueue, brokerConfig, segment);
        this.triggerProcessor = new TriggerQueueProcessor(triggerQueue, brokerConfig, segment);

        let partition: number[] = [];
        this.instance.on('lock-allocation', async ({ group, partitionTable }) => {
            if(group === this.instance.name) {
                partition = partitionTable[this.instance.uuid] || partition;
                if(partition.length) {
                    debug('allocating buckets', `[${partition[0]}..${partition[partition.length-1]}]`);
                    await reducerQueue.allocateBuckets(partition, segment)
                }
            }
        });

        this.instance.on('bucket-update', async ({ segment, bucket }) => {
            if(segment === (this.segment || '') && partition.includes(bucket)) {
                debug('allocating buckets', `[${partition[0]}..${partition[partition.length-1]}]`);
                await reducerQueue.allocateBuckets(partition, segment)
            }
        });

        this.channelMapping = new ActionMappingSet();
        this.reducerManager = new ReducerManager(this.reducerProcessor, brokerConfig, this.channelMapping, this.tryGetActionInfo);
        this.triggerManager = new TriggerManager(this.triggerProcessor);
        this.dispatcher = new ActionDispatcher(brokerConfig);
        this.emitter = new ActionEmitter(brokerConfig);
        this.leaderboardStore = new LeaderboardStore(redis, prefix);
        this.prefix = prefix;
        this.redis = redis
    }

    private tryGetActionInfo = (name: string|LiveOpsActionType): LiveOpsActionInfo => this.actionLookup[name.toString()] || {};

    resource(name: string, options?: LiveOpsServiceFluentResourceProviderOptions) {
        return new LiveOpsServiceFluentResourceProvider(this, name, options)
    }

    action<TPayload = AnyPayload>(name: LiveOpsActionType<TPayload>|string, descriptor: LiveOpsActionDescriptor<TPayload> = {}) {
        const realName = name.toString();

        if(this.actions.find(a => a.name === realName)) {
            throw new Error('Duplicate action definitions are not allowed: ' + realName)
        }

        descriptor.segment = descriptor.segment || segmentProvider(realName);

        const action = new LiveOpsAction(name, descriptor, this.segment);
        this.reducerManager.reducer(action.name, action.reducer);
        action.triggers.forEach(trigger => this.triggerManager.trigger(action.name, trigger));
        action.provideChannelMapping(this.channelMapping);

        this.actions.push(action);
        this.actionLookup[realName] = action;

        return this
    }

    register({ name, version }: { name: string, version: string }) {
        this.instance.register(name, version, async () => {
            const set = new ActionMappingSet();
            this.actions.forEach(action => action.provideResourceMapping(set));
            return {
                ...set.serialize(),
                segment: this.segment
            }
        })
    }

    start() {
        this.reducerProcessor.start();
        this.triggerProcessor.start()
    }

    stop() {
        this.reducerProcessor.stop();
        this.triggerProcessor.stop()
    }
}