import {ApiBase} from "./api-base";
import {LiveOpsSession} from "./types";
import {TokenProvider} from "./token-provider";

export class LiveOpsApi extends ApiBase {
    private readonly segment?: string[]|string;

    constructor(tokenProvider: TokenProvider, segment?: string[]|string) {
        super(tokenProvider);
        this.segment = segment
    }

    sessions = {
        getMetadata: (session: string) =>
            this.get<any>('sessions.getMetadata', 'liveops-sessions/metadata',
                { session }, [], 'POST'),

        listForUser: (user: string) =>
            this.list<LiveOpsSession>('sessions.listForUser', 'liveops-sessions',
                { user, segments: this.segment }),

        listActiveUsers: (group: string) =>
            this.list<string>('sessions.listActiveUsers', 'liveops-sessions/user-list',
                { group, segment: this.segment }, [], 'POST'),

        listGroupsForUser: (user: string) =>
            this.list<string>('sessions.listGroupsForUser', 'liveops-sessions/group-list',
                { user, segment: this.segment }, [], 'POST'),
    };

    statistics = {
        //TODO: encodeURIComponent(stat) - is it required?
        getUserStatisticDeltaSince: (sinceDate: Date, group: string, stat: string, owner: string) =>
            this.list<{ delta: number }>('statistics.getUserStatisticDeltaSince', 'user-statistic-updates',
                {
                    'where[createdAt][gte]': sinceDate.toISOString(),
                    group, stat, owner, fields: 'delta'
                }, 0)
                .then(updates => updates.reduce((prev, { delta }) => prev + delta, 0)),

        list: (group: string) =>
            this.get<{ names: string[], version?: number }>('properties.list', 'user-statistics/stat-list',
                { group }, { names: [] })
    };

    properties = {
        //TODO: encodeURIComponent(prop) - is it required?
        getValue: (owner: string, group: string, prop: string) =>
            this.list<{ value: number }>('properties.getValue', 'user-properties',
                { group, prop, owner, limit: 1, fields: 'value' }, 0)
                .then(stats => (stats[0] || { value: 0 }).value),

        setValue: (owner: string, group: string, prop: string, value: string) =>
            this.create<any>('properties.getValue', 'user-properties/set',
                { group, prop, owner },
                { value })
                .then(() => true)
    }
}

export const api = {





};