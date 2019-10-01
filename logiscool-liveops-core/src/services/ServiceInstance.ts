import {ServiceGroup} from "./ServiceManager";
import {RedisClient} from "redis";
import {EventEmitter} from "events";

const debug = require('debug')('logiscool-liveops:service-instance');
const NRP = require("node-redis-pubsub");
const uuidv4 = require('uuid/v4');

export class ServiceInstance extends EventEmitter {
    private nrp: any;
    private timer: any;
    private systemVersion: number = 0;
    private metadataProvider: () => Promise<any>;
    private version: string;
    private isLeader_: boolean;

    uuid: string;
    name: string;
    heartbeatIntervalMS = 1000;
    groups: Record<string, ServiceGroup> = {};

    get isLeader() { return this.isLeader_ }

    constructor(redisIn: RedisClient, redisOut: RedisClient, prefix: string) {
        super();

        const nrp = this.nrp = new NRP({
            emitter: redisOut,
            receiver: redisIn,
            scope: `${prefix}:service-manager:nrp`
        });

        nrp.on("error", (err: any) => debug('NRP error', err));
        nrp.on("system-setup", this.handleSetup);
        nrp.on("system-update", this.handleSystemUpdate);
        nrp.on("group-update", this.handleGroupUpdate);
        nrp.on('service-broadcast', ({ type, data }: any) => this.emit(type, data))
    }

    register(name: string, version: string, metadataProvider: () => Promise<any>) {
        this.name = name;
        this.version = version;
        this.metadataProvider = metadataProvider;
        const uuid = this.uuid = uuidv4();

        this.nrp.emit('service-add', {
            uuid,
            name,
            version
        });

        this.enable()
    }

    enable() {
        if (this.timer) return;
        this.timer = setInterval(this.handleTick, this.heartbeatIntervalMS)
    }

    disable() {
        if(!this.timer) return;
        clearInterval(this.timer);
        this.timer = false
    }

    broadcast(type: string, data: any) {
        this.nrp.emit('service-broadcast', { type, data })
    }

    private handleTick = async () => {
        this.nrp.emit('service-heartbeat', {
            service: {
                uuid: this.uuid,
                name: this.name,
                version: this.version,
                metadataVersion: this.version,
                metadata: await this.getMetadata()
            },
            systemVersion: this.systemVersion
        })
    };

    private handleSetup = (uuid: string) => {
        if(this.uuid) {
            debug(`[${this.uuid}] system setup request by ${uuid}`);
            this.isLeader_ = false;
            this.handleTick()
        }
    };

    private handleSystemUpdate = (version: number) => {
        this.systemVersion = version;
        this.emit('system-update', this.systemVersion);
        debug('system version updated', this.systemVersion)
    };

    private handleGroupUpdate = async (group: ServiceGroup) => {
        this.groups[group.name] = group;

        if(group.name === this.name) {
            if(this.isLeader && group.leader !== this.uuid) {
                this.isLeader_ = false;
                this.emit('revoked')
            }
            else if(!this.isLeader && group.leader === this.uuid) {
                this.isLeader_ = true;
                this.emit('elected');
                const metadata =this.getMetadata();
                debug('sending metadata');
                this.nrp.emit('group-metadata', {
                    name: this.name,
                    metadataVersion: this.version,
                    metadata
                })
            }
        }
    }

    private metadata: any;
    private async getMetadata() {
        return this.metadata || ( this.metadata = await this.metadataProvider())
    }
}