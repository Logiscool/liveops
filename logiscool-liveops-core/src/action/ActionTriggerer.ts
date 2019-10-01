import axios from 'axios';
import {BrokerConfiguration} from "./ActionEmitter";
const debug = require('debug')('logiscool-liveops:action-triggerer');

export class ActionTriggerer {
    private readonly brokerURI: string;
    private readonly accessToken: string;
    private readonly segment: string|undefined|null;

    constructor({ brokerURI, accessToken }: BrokerConfiguration, segment?: string|null) {
        this.brokerURI = brokerURI;
        this.accessToken = accessToken;
        this.segment = segment
    }

    trigger(action: any, segments?: string[]) {
        const data: any = {
            access_token: this.accessToken,
            action
        };

        if(segments) data.segments = segments;
        else data.segment = this.segment;

        return axios
            .post(`${this.brokerURI}/trigger-action`, data)
            .catch(e => debug(`trigger ERROR: [${action.type}][${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`))
    }

    triggerClient(clientId: string|null, action: any) {
        if (!action || !clientId) return;
        action.client = clientId;
        return this.trigger(action)
    }
}