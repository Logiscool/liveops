import {RedisClient} from "redis";
import {EventEmitter} from "events";

const debug = require('debug')('logiscool-liveops:service-manager');
const NRP = require("node-redis-pubsub");
const Leader = require('redis-leader');
const uuidv4 = require('uuid/v4');

export interface ServiceGroup {
    name: string
    version: string
    leader: string
    systemVersion: number
    metadataVersion: string|boolean
    metadata?: any
}

export interface Service {
    uuid: string
    name: string
    version: string
}

interface ManagedService extends Service {
    ttl: number
    isLeader: boolean
    systemVersion: number
}

interface HeartbeatMessage {
    service: Service & {
        metadataVersion: string
        metadata: any
    }
    systemVersion: number
}

export interface GroupMetadataMessage {
    name: string
    metadataVersion: string
    metadata: any
}

interface SystemStatus {
    systemVersion: number,
    groups: ServiceGroup[],
    services: ManagedService[]
}

export class ServiceManager extends EventEmitter {
    private nrp: any;
    private nrpManagers: any;
    private groupLookupTable: Record<string, ServiceGroup> = {};
    private serviceLookupTable: Record<string, ManagedService> = {};
    private timer: any;
    private systemVersion: number = 0;
    private lastIncomingSystemVersion: number = 0;
    private isLeader_: boolean;
    private inited: boolean = false;

    readonly uuid: string;
    services: ManagedService[] = [];
    groups: ServiceGroup[] = [];
    defaultTTL = 10;
    checkIntervalMS = 2000;

    get isLeader() { return this.isLeader_ }

    constructor(redisIn: RedisClient, redisOut: RedisClient, prefix: string) {
        super();
        this.uuid = uuidv4();

        const leader = new Leader(redisOut, { key: `${prefix}:service-manager:leader` });
        leader.on("error", (err: any) => debug('Leader error', err));
        leader.on('elected', () => {
            debug(`[${this.uuid}] elected as leader`);
            this.inited = true;
            this.isLeader_ = true;
            this.services = [];
            this.groups = [];
            this.groupLookupTable = {};
            this.serviceLookupTable = {};
            this.nrp.emit('system-setup', this.uuid);
            debug(`[${this.uuid}] system reset`);
            this.enable()
        });
        leader.on('revoked', () => {
            this.isLeader_ = false;
            this.disable();
            leader.elect()
        });
        leader.elect();

        const nrp = this.nrp = new NRP({
            emitter: redisOut,
            receiver: redisIn,
            scope: `${prefix}:service-manager:nrp`
        });

        const nrpManagers = this.nrpManagers = new NRP({
            emitter: redisOut,
            receiver: redisIn,
            scope: `${prefix}:service-manager:nrp-managers`
        });

        nrp.on("error", (err: any) => debug('NRP error', err));
        nrp.on("service-remove", this.handleRemoval);
        nrp.on("service-heartbeat", this.handleHeartbeat);
        nrp.on("system-update", (version: number) => this.lastIncomingSystemVersion = version);
        nrp.on("system-status", this.handleStatus);
        nrp.on("system-status-request", this.handleStatusRequest);
        nrp.on("group-metadata", this.handleMetadata);
        nrp.on('service-broadcast', ({ type, data }: any) => this.emit(type, data));

        nrpManagers.on('manager-broadcast', ({ type, data }: any) => this.emit(type, data))
    }

    enable() {
        if(this.isLeader) {
            if (this.timer) return;
            this.timer = setInterval(this.handleTick, this.checkIntervalMS);
        }
        else {
            const initTimer = setInterval(() => {
                if(this.inited) {
                    if(initTimer) clearInterval(initTimer)
                }
                else {
                    this.nrp.emit('system-status-request', {})
                }
            }, 500);
            this.nrp.emit('system-status-request', {})
        }
    }

    disable() {
        if(!this.timer) return;
        clearInterval(this.timer);
        this.timer = false
    }

    broadcast(type: string, data: any) {
        this.nrp.emit('service-broadcast', { type, data })
    }

    broadcastToManagers(type: string, data: any) {
        this.nrpManagers.emit('manager-broadcast', { type, data })
    }

    private handleTick = () => {
        //Decrement the TTL of each service and remove services not alive.
        for(let service of this.services) {
            service.ttl--;
            if(service.ttl <= 0) {
                this.nrp.emit('service-remove', service.uuid)
            }
        }
    };

    private handleStatusRequest = () => {
        if(!this.isLeader) return;
        this.nrp.emit('system-status', {
            systemVersion: this.systemVersion,
            services: this.services,
            groups: this.groups
        })
    };

    private handleStatus = (status: SystemStatus) => {
        if(this.isLeader || this.inited) return;
        this.inited = true;

        if(status.systemVersion < this.lastIncomingSystemVersion) {
            this.nrp.emit('system-status-request', {});
            return
        }

        this.systemVersion = status.systemVersion;
        this.services = status.services;
        this.groups = status.groups;

        for(let service of this.services) {
            this.serviceLookupTable[service.uuid] = service
        }

        for(let group of this.groups) {
            this.groupLookupTable[group.name] = group
        }

        this.emit('system-update', this.systemVersion);
        this.emit('system-status');
        debug(`[${this.uuid}] inited as slave`);
    };

    private handleRemoval = (uuid: string) => {
        const service = this.serviceLookupTable[uuid];
        if(service) {
            debug('service removed', service.name, service.uuid);
            delete this.serviceLookupTable[service.uuid];
            const index = this.services.indexOf(service);
            if (index !== -1) {
                this.services.splice(index, 1);
                this.emit('service-remove', service);
                this.updateGroup(service.name)
            }
        }
    };

    private tryFindGroupVersion(name: string) {
        //A groups version is the latest version which every service instance had at a time.
        //If currently there are multiple versions running, it is not possible to find the group version.

        const services = this.services.filter(s => s.name === name);
        if(services.length) {
            let version = services[0].version;
            if(services.every(s => s.version === version)) return version
        }
        return false
    }

    private tryFindGroupSystemVersion(name: string) {
        //A groups version is the latest version which every service instance had at a time.
        //If currently there are multiple versions running, it is not possible to find the group version.

        const services = this.services.filter(s => s.name === name);
        if(services.length) {
            let version = services[0].systemVersion;
            if(services.every(s => s.systemVersion === version)) return version
        }
        return false
    }

    private updateSystem() {
        this.systemVersion++;
        if(this.isLeader) this.nrp.emit('system-update', this.systemVersion);
        this.emit('system-update', this.systemVersion);
        debug('system version updated', this.systemVersion)
    }

    private updateGroup = (name: string) => {
        const groupService = this.services.find(s => s.name === name);
        if(groupService) {
            const group = this.groupLookupTable[name];
            let updated = false;
            let systemUpdated = false;

            const newSystemVersion = this.tryFindGroupSystemVersion(name);
            if(newSystemVersion && group.systemVersion !== newSystemVersion) {
                group.systemVersion = newSystemVersion;
                updated = true;
                debug('group system version updated:', name, '-->', newSystemVersion)
            }

            const newVersion = this.tryFindGroupVersion(name);
            if(newVersion && group.version !== newVersion) {
                group.version = newVersion;
                systemUpdated = updated = true;
                debug('group version updated:', name, '-->', newVersion)
            }

            const leaderDead = !this.serviceLookupTable[group.leader];
            if(leaderDead) {
                systemUpdated = updated = true;
                group.leader = groupService.uuid;
                debug('group leader updated:', name, '-->', group.leader)
            }

            if(updated) {
                if(this.isLeader) this.nrp.emit('group-update', group);
                if(systemUpdated) this.updateSystem()
            }
        }
        else {
            //If every instance of a service was removed, remove the group too.

            const group = this.groupLookupTable[name];
            delete this.groupLookupTable[name];
            const groupIndex = this.groups.indexOf(group);
            if(groupIndex !== -1) this.groups.splice(groupIndex, 1);

            this.updateSystem()
        }
    };

    private handleMetadata = (input: GroupMetadataMessage) => {
        const group = this.groupLookupTable[input.name];
        if(!group) {
            debug('WARNING: Missing group for metadata:', input.name);
            return
        }

        if(group.metadataVersion !== input.metadataVersion) {
            group.metadata = input.metadata;
            group.metadataVersion = input.metadataVersion;

            debug('group metadata updated', input.name);
            this.emit('group-metadata', input);
            this.updateSystem()
        }
    };

    private handleRegistration = (service: Service) => {
        //Skip registration of existing service.
        //This should not happen normally.
        const existingService = this.serviceLookupTable[service.uuid];
        if(existingService) {
            debug('WARNING: Existing service registered again:', service.uuid);
            return
        }

        //Managed services have a TTL for automatic removal after certain time
        //without a heartbeat.
        const managedService: ManagedService = {
            ...service,
            ttl: this.defaultTTL,
            isLeader: false,
            systemVersion: this.systemVersion
        };

        this.serviceLookupTable[service.uuid] = managedService;
        this.services.push(managedService);

        debug('service added', service.name, service.uuid);

        this.emit('service-add', service);
        this.handleGroup(service)
    };

    private handleGroup = (service: Service) => {
        const existingGroup = this.groupLookupTable[service.name];
        if(existingGroup) {
            this.updateGroup(service.name);
        }
        else {
            const group = {
                name: service.name,
                version: service.version,
                metadataVersion: false,
                systemVersion: this.systemVersion,
                leader: service.uuid
            };

            this.groupLookupTable[group.name] = group;
            this.groups.push(group);

            if(this.isLeader) this.nrp.emit('group-update', group);
            this.updateSystem()
        }
    };

    private handleHeartbeat = ({ service, systemVersion }: HeartbeatMessage) => {
        //Register missing service.
        const managedService = this.serviceLookupTable[service.uuid];
        if(!managedService) {
            this.handleRegistration(service);
            if(service.metadataVersion) this.handleMetadata(service);

            return
        }

        if(service.metadataVersion) this.handleMetadata(service);

        //Increment the TTL as the service is still alive.
        managedService.ttl = Math.min(10, managedService.ttl + 1);

        if(managedService.systemVersion !== systemVersion) {
            managedService.systemVersion = systemVersion;
            this.updateGroup(managedService.name)
        }
    };

}