import axios from 'axios';
import {LiveOpsActionType} from "../LiveOpsAction";
const debug = require('debug')('logiscool-liveops:action-emitter');

export interface IActionEmitter {
    enqueue(action: any): void;
    enqueueClient(clientId: string|null, action: any): void;
}

export interface IActionEmitterAsync {
    enqueue(action: any): Promise<any>;
    enqueueClient(clientId: string|null, action: any): Promise<any>;
}

export interface BrokerConfiguration {
    brokerURI: string
    accessToken: string
}

export type AnyPayload = any;

export interface ReduxAction<TPayload = AnyPayload> {
    type: string|LiveOpsActionType<TPayload>
    payload: TPayload
}

export interface DistributedReduxAction<TPayload = AnyPayload> extends ReduxAction<TPayload> {
    client?: string|null
    session?: string
    context?: {
        private: any,
        public: any
    }
    meta?: {
        transaction?: string
    }
    error?: boolean
}

export interface ActionWithSubscription<TPayload = AnyPayload> extends DistributedReduxAction<TPayload> {
    subscribe?: boolean
    unsubscribe?: boolean
    dispatched?: boolean
    status?: boolean
    channel?: string[]|string
}

export class ActionEmitter implements IActionEmitterAsync {
    private readonly brokerURI: string;
    private readonly accessToken: string;

    constructor({ brokerURI, accessToken }: BrokerConfiguration) {
        this.brokerURI = brokerURI;
        this.accessToken = accessToken
    }

    enqueue(action: any) {
        return axios
            .post(`${this.brokerURI}/emit-action`, {
                access_token: this.accessToken,
                action
            })
            .catch(e => debug(`enqueue ERROR: [${action.type}][${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`))
    }

    enqueueClient(clientId: string|null, action: any) {
        if (!action || !clientId) return Promise.reject(new Error('Invalid parameters.'));
        action.client = clientId;
        return this.enqueue(action)
    }
}