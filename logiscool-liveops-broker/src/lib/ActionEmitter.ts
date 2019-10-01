import {EventEmitter} from 'events';
import {ReducerQueue, ActionMappingSet} from "@logiscool/liveops-core";
const debug = require('debug')('logiscool-liveops:emitter');

export type SegmentMappingProvider = (action: any) => (string|null);

export class ActionEmitter extends EventEmitter {
    readonly queue: ReducerQueue;
    readonly segmentMappingProvider: SegmentMappingProvider|undefined;
    readonly getSegmentForAction: SegmentMappingProvider;
    resourceMapping: ActionMappingSet;

    private getResourceForAction(action: any) {
        const resource = this.resourceMapping.tryApply(action);

        if(!resource || resource.length === 0) {
            debug('Emitting actions without a resource is not supported:', action.type);
            throw new Error(`Emitting actions without a resource is not supported: ${action.type}`)
        }

        if(resource.length > 1) {
            debug('Emitting multi resource actions is not supported:', action.type);
            throw new Error(`Emitting multi resource actions is not supported: ${action.type}`)
        }

        return resource[0]
    }

    constructor(queue: ReducerQueue, resourceMapping: ActionMappingSet, segmentMappingProvider?: SegmentMappingProvider) {
        super();
        this.setMaxListeners(0);

        this.queue = queue;
        this.resourceMapping = resourceMapping;
        this.segmentMappingProvider = segmentMappingProvider;
        this.getSegmentForAction = this.segmentMappingProvider || (() => null);
    }

    enqueue = async (action: any) => {
        if (!action) return;
        action.context = action.context || {public: {}, private: {}};

        const resource = this.getResourceForAction(action);
        if(resource) {
            return this.queue.enqueue(
                action.client || null, action, resource,
                this.getSegmentForAction(action)
            )
        }
        else {
            throw new Error(`Missing resource for action: ${action.type}`)
        }
    }
}