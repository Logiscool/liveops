import * as SocketIO from "socket.io";
import {TriggerQueue} from "@logiscool/liveops-community";
import {SubChannelStore} from "./src/lib/SubChannelStore";
import {ActionDispatcher} from "./src/lib/ActionDispatcher";
import {setupServiceManager} from "./src/service-manager";
import {Express} from "express";
import {ActionMappingSet, ReducerQueue} from "../logiscool-liveops/dist/src";
import {ActionBroker} from "./src/lib/ActionBroker";

export class LiveOpsBroker {

    private readonly server: any;
    private readonly triggerQueue: TriggerQueue;
    private readonly broker: any;
    private readonly serviceInfo: any;
    private readonly dispatcher: ActionDispatcher;

    constructor(redis: any, redisPub: any, prefix: string = '') {
        const server = this.server = require('http').createServer(),
            io = SocketIO(server, {
                origins: '*:*',
                handlePreflightRequest: (req: any, res: any) => {
                    const headers = {
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-access-token, x-role, x-segments",
                        "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
                        "Access-Control-Allow-Credentials": true
                    };
                    res.writeHead(200, headers);
                    res.end()
                }
            } as any);

        const redisAdapter = require('socket.io-redis');
        io.adapter(redisAdapter({ subClient: redis, pubClient: redisPub }));

        this.triggerQueue = new TriggerQueue(redis, prefix);
        const subChannelStore = new SubChannelStore(redis, prefix);
        const reducerQueue = new ReducerQueue(redis, prefix);
        this.broker = new ActionBroker(io, reducerQueue, subChannelStore, new ActionMappingSet());
        this.dispatcher = new ActionDispatcher(io, subChannelStore);
        this.serviceInfo = setupServiceManager(this.broker, prefix, redis, redisPub)
    }

    mount(app: Express) {
        app.post('/emit-action', async (req, res) => {
            const action = req.body.action;

            if(!action || !action.type) {
                res.status(422).send({ status: 422, error: 'Unprocessable Entry' });
                return
            }

            try {
                await this.broker.enqueue(action);
                res.status(201).send({status: 201})
            }
            catch(e) {
                res.status(400).send({ status: 400, error: e.message })
            }
        });

        app.post('/join-channel', (req, res) => {
            const session = req.body.session;
            const channel = req.body.channel;

            this.serviceInfo.manager.broadcastToManagers('channel-join', { session, channel });

            res.status(201).send({ status: 201 })
        });

        app.post('/leave-channel', (req, res) => {
            const session = req.body.session;
            const channel = req.body.channel;

            this.serviceInfo.manager.broadcastToManagers('channel-leave', { session, channel });

            res.status(200).send({ status: 200 })
        });

        app.post('/add-sub-channel', async (req, res) => {
            const subChannel = req.body.subChannel;
            const channel = req.body.channel;

            await this.broker.addSubChannel(channel, subChannel);

            res.status(201).send({ status: 201 })
        });

        app.post('/remove-sub-channel', async (req, res) => {
            const subChannel = req.body.subChannel;
            const channel = req.body.channel;

            await this.broker.removeSubChannel(channel, subChannel);

            res.status(200).send({ status: 200 })
        });

        app.post('/delete-channel', async (req, res) => {
            const channel = req.body.channel;

            await this.broker.deleteChannel(channel);

            res.status(200).send({ status: 200 })
        });

        app.post('/dispatch-action', async (req, res) => {
            const action = req.body.action;
            const channel = req.body.channel;

            if(!action || !action.type) {
                res.status(422).send({ status: 422, error: 'Unprocessable Entry' });
                return
            }

            if(channel) {
                await this.dispatcher.dispatchOnChannel(channel, action)
            }
            else {
                this.dispatcher.dispatch(action, !!req.body.allowShared)
            }

            res.status(201).send({ status: 201 })
        });

        app.post('/trigger-action', async (req, res) => {
            const action = req.body.action;
            const channel = action.channel;
            const segments: string[] = req.body.segments || this.serviceInfo.segments;

            if(!action || !action.type) {
                res.status(422).send({ status: 422, error: 'Unprocessable Entry' });
                return
            }

            if(channel) {
                await this.dispatcher.dispatchOnChannel(channel, action)
            }
            else {
                this.dispatcher.dispatch(action)
            }

            if(req.body.segment) {
                await this.triggerQueue.enqueue(action.client || null, action, req.body.segment);
            }
            else {
                await Promise.all([
                    this.triggerQueue.enqueue(action.client || null, action),
                    ...segments.map(segment => this.triggerQueue.enqueue(action.client || null, action, segment))
                ])
            }
            res.status(201).send({ status: 201 })
        });
    }

    listen(port: any) {
        this.server.listen(port)
    }

}