import {Reducer} from "./managers/ReducerManager";
import {TriggerHandler} from "./managers/TriggerManager";
import {ActionMappingSet} from "./mapping/ActionMappingSet";
import {ActionMapping} from "./mapping/ActionMapping";
import {AnyPayload, DistributedReduxAction} from "./action/ActionEmitter";

export interface LiveOpsActionInfo {
    autoChannelJoin?: boolean
    autoChannelLeave?: boolean
}

export type ChannelProvider<TPayload = AnyPayload> = (action: DistributedReduxAction<TPayload>) => string[]

export interface LiveOpsActionDescriptor<TPayload = AnyPayload> extends LiveOpsActionInfo {
    resource?: string //TODO: Support false
    channel?: ChannelProvider<TPayload>|string[]|string|false
    reducer?: Reducer<TPayload>
    trigger?: TriggerHandler<TPayload>[]|TriggerHandler<TPayload>
    segment?: string
}

export class LiveOpsActionType<TPayload = AnyPayload> {
    readonly name: string;

    constructor(name: string) {
        this.name = name
    }

    toString = () => { return this.name };
    toJSON = () => { return this.name }
}

export class LiveOpsAction<TPayload = AnyPayload> {

    readonly name: string;
    readonly resource: string;
    readonly segment: string;
    readonly channel: ActionMapping|string[]|string|false;
    readonly reducer: Reducer<TPayload>;
    readonly triggers: TriggerHandler<TPayload>[] = [];
    readonly autoChannelJoin: boolean;
    readonly autoChannelLeave: boolean;

    constructor(name: LiveOpsActionType<TPayload>|string, { resource, channel, reducer, trigger, autoChannelJoin = false, autoChannelLeave = false, segment }: LiveOpsActionDescriptor<TPayload>, targetSegment: string = '') {
        this.name = name.toString();
        this.segment = segment || '';
        this.autoChannelJoin = autoChannelJoin;
        this.autoChannelLeave = autoChannelLeave;

        if(reducer) {
            this.reducer = reducer;
        }

        if(reducer || segment === targetSegment) {
            let processedResource: string;
            if(typeof resource === 'undefined') processedResource = 'account:{client}';
            else processedResource = resource;
            this.resource = processedResource;

            let processedChannel: ActionMapping|string[]|string|false;
            if(typeof channel === 'function') processedChannel = ActionMapping.forCustomMapper(this.name, channel);
            else if(typeof channel === 'undefined') processedChannel = resource || false;
            else processedChannel = channel;
            this.channel = processedChannel
        }

        if(trigger) {
            this.triggers = Array.isArray(trigger) ? trigger : [ trigger ]
        }
    }

    provideResourceMapping(set: ActionMappingSet) {
        if(this.resource) {
            set.mapping(this.name, this.resource)
        }
    }

    provideChannelMapping(set: ActionMappingSet) {
        if(this.channel) {
            if (this.channel instanceof ActionMapping) {
                set.mapping(this.channel)
            } else {
                set.mapping(this.name, this.channel)
            }
        }
    }

}