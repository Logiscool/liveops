import axios from 'axios';
import {BrokerConfiguration} from "./ActionEmitter";
import {ActionWithFollowUp} from "..";
const debug = require('debug')('logiscool-liveops:action-dispatcher');

export class ActionDispatcher {
    private readonly brokerURI: string;
    private readonly accessToken: string;

    constructor({ brokerURI, accessToken }: BrokerConfiguration) {
        this.brokerURI = brokerURI;
        this.accessToken = accessToken
    }

    dispatch(action: ActionWithFollowUp, channel?: string|string[], allowShared?: boolean) {
        return axios
            .post(`${this.brokerURI}/dispatch-action`, {
                access_token: this.accessToken,
                action, channel, allowShared
            })
            .catch(e => e.response
                ? debug(`dispatch ERROR: [${action.type}][${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`dispatch ERROR:`, action.type, e))
    };

    dispatchForSession(session: string, action: ActionWithFollowUp) {
        return this.dispatch({ ...action, session, client: undefined })
    }

    joinChannel(session: string, channel: string[]|string) {
        return axios
            .post(`${this.brokerURI}/join-channel`, {
                access_token: this.accessToken,
                session, channel
            })
            .catch(e => e.response
                ? debug(`joinChannel ERROR: [${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`joinChannel ERROR:`, e))
    }

    leaveChannel(session: string, channel: string[]|string) {
        return axios
            .post(`${this.brokerURI}/leave-channel`, {
                access_token: this.accessToken,
                session, channel
            })
            .catch(e => e.response
                ? debug(`leaveChannel ERROR: [${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`leaveChannel ERROR:`, e))
    }

    addSubChannel(channel: string, subChannel: string) {
        return axios
            .post(`${this.brokerURI}/add-sub-channel`, {
                access_token: this.accessToken,
                channel, subChannel
            })
            .catch(e => e.response
                ? debug(`addSubChannel ERROR: [${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`addSubChannel ERROR:`, e))
    }

    removeSubChannel(channel: string, subChannel: string) {
        return axios
            .post(`${this.brokerURI}/remove-sub-channel`, {
                access_token: this.accessToken,
                channel, subChannel
            })
            .catch(e => e.response
                ? debug(`removeSubChannel ERROR: [${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`removeSubChannel ERROR:`, e))
    }

    deleteChannel(channel: string) {
        return axios
            .post(`${this.brokerURI}/delete-channel`, {
                access_token: this.accessToken,
                channel
            })
            .catch(e => e.response
                ? debug(`deleteChannel ERROR: [${e.response.status}][${e.response.data ? e.response.data.error : 'unknown error'}]`)
                : debug(`deleteChannel ERROR:`, e))
    }
}