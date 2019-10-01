import {ActionMappingSet, GroupMetadataMessage, ServiceManager, Service, ServiceGroup} from "@logiscool/liveops";
import {ActionBroker} from "./lib/ActionBroker";

const debug = require('debug')('logiscool-liveops:service-group-manager');

function generatePartitions(bucketCount: number, partitionCount: number) {
    if(partitionCount > bucketCount) {
        throw new Error('Too many partitions requested.')
    }

    if(!partitionCount || !bucketCount) {
        throw new Error('Invalid arguments.')
    }

    const normalLength = Math.ceil(bucketCount / partitionCount);
    const extraCount = (normalLength * partitionCount) - bucketCount;
    const partitionLengths = new Array(partitionCount).fill(normalLength);

    if(extraCount) {
        for(let i = 0; i < extraCount; i++) {
            partitionLengths[i]--
        }
    }

    const partitions = [];
    for(let delta = 0, partitionIndex = 0; partitionIndex < partitionCount; delta += partitionLengths[partitionIndex], partitionIndex++) {
        const partitionLength = partitionLengths[partitionIndex];
        const partition = [];
        for(let i = 0; i < partitionLength; i++) {
            partition.push(i + delta)
        }
        partitions.push(partition)
    }

    return partitions
}

function printPartition(partition: number[]) {
    return `[${partition[0]}..${partition[partition.length-1]}]`
}

export function setupServiceManager(broker: ActionBroker, prefix: string, redis: any, redisPub: any) {
    const serviceManager = new ServiceManager(redis, redisPub, prefix);
    const bucketCount = broker.queue.bucketCount;
    let groupMetadata: (GroupMetadataMessage|ServiceGroup)[] = [];

    const output: {
        segments: string[],
        manager: ServiceManager
    } = {
        segments: [],
        manager: serviceManager
    };

    function printStatus(msg: string) {
        debug(
            `[${serviceManager.uuid}][v0.15]`,
            serviceManager.isLeader ? "leader" : 'slave',
            'active segments:', output.segments,
            ', service groups:', groupMetadata.map(gm => gm.name),
            'after', msg
        )
    }

    function applyGroupMetadata() {
        const newMapping = new ActionMappingSet();
        const newSegments = [];
        for (let gm of groupMetadata) {
            if(gm.metadata.segment) newSegments.push(gm.metadata.segment);
            newMapping.mappingSet(gm.metadata)
        }
        broker.resourceMapping = newMapping;
        output.segments = newSegments;
    }

    function allocateLocks(group: string) {
        try {
            if (!serviceManager.isLeader) {
                debug(`[${serviceManager.uuid}]`, 'not a leader');
                return;
            }

            debug(`[${serviceManager.uuid}]`, 'is a leader, allocating locks');

            const groupServices = serviceManager.services.filter(s => s.name === group);
            const partitions = generatePartitions(bucketCount, groupServices.length);
            const partitionTable: Record<string, number[]> = {};

            for (let i = 0; i < partitions.length; i++) {
                partitionTable[groupServices[i].uuid] = partitions[i]
            }

            debug(bucketCount, 'buckets,', groupServices.length, 'partitions');
            debug('allocating locks for', group, Object.keys(partitionTable)
                .map(uuid => `${uuid.substr(0, 8)}: ${printPartition(partitionTable[uuid])}`).join(', '));
            serviceManager.broadcast('lock-allocation', {group, partitionTable})
        }
        catch(e) {
            debug('allocateLocks ERROR:', e.message)
        }
    }

    serviceManager.on('system-status', () => {
        groupMetadata = serviceManager.groups.filter(group => group.metadata);
        for(let { name } of serviceManager.groups) allocateLocks(name);
        debug('initial setup');
        applyGroupMetadata();
        printStatus('system-status')
    });

    serviceManager.on('group-metadata', (input: GroupMetadataMessage) => {
        const index = groupMetadata.findIndex(gm => gm.name === input.name);
        if (index === -1) groupMetadata.push(input);
        else groupMetadata[index] = input;
        applyGroupMetadata();
        printStatus('group-metadata')
    });

    serviceManager.on('service-add', (service: Service) => {
        debug('service added', service.name, service.uuid);
        allocateLocks(service.name);
    });

    serviceManager.on('service-remove', (service: Service) => {
        debug('service removed', service.name, service.uuid);
        allocateLocks(service.name);
        applyGroupMetadata();
        printStatus('service-remove')
    });

    serviceManager.on('channel-join', async ({ session, channel }) => {
        try {
            await broker.joinChannel(session, channel)
        }
        catch(e) {
            debug('JOIN CHANNEL ERROR', e)
        }
    });

    serviceManager.on('channel-leave', async ({ session, channel }) => {
        try {
            await broker.leaveChannel(session, channel)
        }
        catch(e) {
            debug('JOIN CHANNEL ERROR', e)
        }
    });

    return output
}