import * as SocketIO from "socket.io";
import {
    ActionMappingSet,
    ActionWithFollowUp,
    ActionWithSubscription,
    ReducerQueue,
    REQUEST_PRESENT,
    setTransaction
} from "@logiscool/liveops-core";
import {ActionEmitter, SegmentMappingProvider} from "./ActionEmitter";
import {ActionDispatcher} from "./ActionDispatcher";
import {SubChannelStore} from "./SubChannelStore";

const debug = require('debug')('logiscool-liveops:broker');

function defaultSegmentProvider(action: any) {
    const typeParts = action.type.split('/');
    if(typeParts.length >= 3) return typeParts[1].toLowerCase();
    return null
}

export class ActionBroker extends ActionEmitter {
    private socketMapping: Record<string, SocketIO.Socket> = {};
    private readonly subChannelStore: SubChannelStore;

    constructor(io: SocketIO.Server, queue: ReducerQueue, subChannelStore: SubChannelStore, resourceMapping: ActionMappingSet, segmentMappingProvider: SegmentMappingProvider = defaultSegmentProvider) {
        super(queue, resourceMapping, segmentMappingProvider);
        const dispatcher = new ActionDispatcher(io, subChannelStore);
        this.subChannelStore = subChannelStore;

        io.on('connection', (socket: any) => {
            this.socketMapping[socket.id] = socket;
            debug('client connected', socket.id);
            this.emit('authentication', socket, async (clientId: string = socket.id, clientDetails: any) => {
                socket.join(clientId);

                debug('client authenticated', socket.id, '-->', clientId);

                //TODO: Allow services to decide whether an action is shared

                socket.on('action', (action: ActionWithSubscription) => {
                    this.emit('permission-check', { clientId, clientDetails, action, shared: true }, (approve: boolean) => {
                        if(!approve) return;
                        setTransaction(action);
                        action.client = clientId;
                        action.session = socket.id;
                        action.context = { public: {}, private: {} };
                        this.enqueue(action).catch(e => debug(e.message))
                    })
                });

                socket.on('client-action', (action: ActionWithFollowUp) => {
                    this.emit('permission-check', { clientId, clientDetails, action, shared: false }, (approve: boolean) => {
                        if(!approve) return;
                        setTransaction(action);
                        action.client = clientId;
                        action.session = socket.id;
                        action.context = { public: {}, private: {} };

                        dispatcher.dispatchSession(socket.id, action);

                        this.enqueue(action).catch(e => debug(e.message))
                    })
                });

                socket.on('present', () => this.enqueue({
                    session: socket.id,
                    client: clientId,
                    type: REQUEST_PRESENT
                }).catch(e => debug(e.message)));

                const activeTicker = setInterval(
                    () => this.emit('active', socket, clientId, clientDetails),
                    60000
                );

                socket.on('disconnect', () => {
                    delete this.socketMapping[socket.id];
                    debug('client disconnected', clientId, socket.id);
                    clearInterval(activeTicker);
                    this.emit('disconnect', socket, clientId, clientDetails)
                });

                this.enqueue({ session: socket.id, client: clientId, type: REQUEST_PRESENT })
                    .catch(e => debug(e.message))
            })
        });

        this.emit('ready')
    }

    private joinSingleChannel(socket: SocketIO.Socket, channel: string) {
        return new Promise((resolve, reject) => {
            debug('joining', socket.id, channel);
            socket.join(channel, (err: any) => {
                if(err) reject(err);
                else resolve()
            })
        })
    }

    private leaveSingleChannel(socket: SocketIO.Socket, channel: string) {
        return new Promise((resolve, reject) => {
            socket.leave(channel, (err: any) => {
                if(err) reject(err);
                else resolve()
            })
        })
    }

    async joinChannel(socketId: string, channel: string[]|string) {
        const socket = this.socketMapping[socketId];
        if(socket) {
            if(typeof channel === 'string') {
                await this.joinSingleChannel(socket, channel);
            }
            else {
                for (let c of channel) {
                    await this.joinSingleChannel(socket, c);
                }
            }
        }
    }

    async leaveChannel(socketId: string, channel: string[]|string) {
        const socket = this.socketMapping[socketId];
        if(socket) {
            if(typeof channel === 'string') {
                await this.leaveSingleChannel(socket, channel);
            }
            else {
                for (let c of channel) {
                    await this.leaveSingleChannel(socket, c);
                }
            }
        }
    }

    async addSubChannel(channel: string, subChannel: string) {
        return this.subChannelStore.addSubChannel(channel, subChannel)
    }

    async removeSubChannel(channel: string, subChannel: string) {
        return this.subChannelStore.removeSubChannel(channel, subChannel)
    }

    async deleteChannel(channel: string) {
        return this.subChannelStore.deleteChannel(channel)
    }
}