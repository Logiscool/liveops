import * as SocketIO from "socket.io";
import {SubChannelStore} from "./SubChannelStore";

const debug = require('debug')('logiscool-liveops:dispatcher');

function extractPublicAction(action: any) {
    const { type, payload, meta, context = { public: {}, private: {} } } = action;
    const error = action.error || typeof context.public.error !== 'undefined' ? true : undefined;
    return {type, payload, error, meta: {...(meta || {}), context: context.public}}
}

export class ActionDispatcher {
    private readonly io: SocketIO.Server;
    private readonly subChannelStore: SubChannelStore;

    constructor(io: SocketIO.Server, subChannelStore: SubChannelStore) {
        this.io = io;
        this.subChannelStore = subChannelStore
    }

    dispatch = (action: any, allowShared = false) => {
        if (!action || action.dispatched) return;

        if(action.client) {
            this.dispatchClient(action.client, action)
        }
        else if(action.session) {
            this.dispatchSession(action.session, action)
        }
        else if(allowShared) {
            this.dispatchShared(action)
        }
    };

    dispatchShared = (action: any) => {
        if (!action || action.dispatched) return;
        action.dispatched = true;

        const publicAction = extractPublicAction(action);
        debug('action', publicAction);
        this.io.emit('action', { action: publicAction })
    };

    dispatchOnChannel = async (channel: string|string[], action: any) => {
        if (!action || action.dispatched) return;
        action.dispatched = true;

        const publicAction = extractPublicAction(action);
        debug('action', publicAction, 'channel:', channel);
        const outputAction = { action: publicAction };

        const baseChannels = typeof channel === 'string' ? [ channel ] : channel;
        //TODO: Replace with flat(2) when NodeJS 12 arrives
        channel = ([] as string[]).concat(...[
            baseChannels,
            ...(await Promise.all(
                baseChannels.map(channel => this.subChannelStore.getSubChannels(channel))
            ))
        ]);

        let sender: any = this.io;
        for(let c of channel) sender = sender.to(c);
        sender.emit('action', outputAction)
    };

    dispatchClient = (client: string | null, action: any) => {
        if (!action || !client || action.dispatched) return;
        action.dispatched = true;

        const publicAction = extractPublicAction(action);
        debug('client action', publicAction);
        this.io.to(client).emit('action', { action: publicAction, client })
    };

    dispatchSession = (session: string | null, action: any) => {
        if (!action || !session || action.dispatched) return;
        action.dispatched = true;

        const publicAction = extractPublicAction(action);
        debug('session action', publicAction);
        this.io.to(session).emit('action', { action: publicAction })
    }
}