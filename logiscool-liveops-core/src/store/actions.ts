import {
    SET_STATISTIC,
    SET_CURRENCY_REFILL,
    ADD_TO_INVENTORY,
    SEND_NOTIFICATION,
    STATISTIC_CHANGE_NOTIFICATION,
    SCHEDULE_ACTION,
    CHANGE_STATISTIC_TO,
    ADD_SESSION_TO_GROUP, REMOVE_SESSION_FROM_GROUP, SET_SESSION_METADATA, UNSET_SESSION_METADATA
} from "../api";
import {InventoryItem, CatalogItem, PushNotification, PushProvider} from "./models";
import {changeNumericValue, createAction, setNumericValue} from "../helpers";
import * as moment from 'moment';

const STAT_CHANGE_NOTIF_DELAY_MINUTES = 10;

export const incrementUserStatistic = (client: string, group: string, stat: string, amount: number) =>
    changeNumericValue(client, 'statistic', Math.abs(amount), { group, stat });

export const decrementUserStatistic = (client: string, group: string, stat: string, amount: number) =>
    changeNumericValue(client, 'statistic', -1 * amount, { group, stat });

export const incrementUserStatisticTo = (client: string, group: string, stat: string, value: number) => createAction({
    type: CHANGE_STATISTIC_TO,
    client,
    payload: { group, stat, value }
});

export const changeUserStatisticTo = (client: string, group: string, stat: string, value: number) => createAction({
    type: CHANGE_STATISTIC_TO,
    client,
    payload: { group, stat, value, allowDecrement: true }
});

export const changeStatisticTo = (target: string, group: string, stat: string, value: number) => createAction({
    type: CHANGE_STATISTIC_TO,
    payload: { target, group, stat, value, allowDecrement: true }
});

export const incrementStatistic = (target: string, group: string, stat: string, amount: number) =>
    changeNumericValue(null, 'statistic', Math.abs(amount), { target, group, stat });

export const decrementStatistic = (target: string, group: string, stat: string, amount: number) =>
    changeNumericValue(null, 'statistic', -1 * amount, { target, group, stat });

export const changeCurrency = (client: string, currency: string, amount: number) =>
    changeNumericValue(client, 'currency', amount, { currency });

export const setCurrency = (client: string, currency: string, prevValue: number, value: number) =>
    setNumericValue(client, 'currency', prevValue, value, { currency });

export const changeCapacity = ({ id, name: item, catalog }: CatalogItem, amount: number) =>
    changeNumericValue(null, 'capacity', amount, { id, item, catalog });

export const changeInventory = (client: string, { id, name: item }: CatalogItem, amount: number) =>
    changeNumericValue(client, 'inventory', amount, { id, item });

export const setStatistic = (target: string, group: string, stat: string, version: string|undefined, value: number) => createAction({
    type: SET_STATISTIC,
    payload: { target, group, stat, version, value }
});

export const setClientStatistic = (client: string, group: string, stat: string, version: string|undefined, value: number) => createAction({
    type: SET_STATISTIC,
    client,
    payload: { group, stat, version, value }
});

export const setCurrencyRefill = (client: string, currency: string, refillsAt: Date|null) => createAction({
    type: SET_CURRENCY_REFILL,
    client,
    payload: { currency, refillsAt }
});

export const addToInventory = (client: string, item: InventoryItem) => createAction({
    type: ADD_TO_INVENTORY,
    client,
    payload: { item }
});

export const sendNotification = (target: string, channel: string, message: PushNotification, persistent = false, providers: PushProvider[] = [ 'in-app', 'push' ]) => createAction({
    type: SEND_NOTIFICATION,
    payload: { message, channel, persistent, target, providers }
});

export const scheduleAction = (action: any, forDate: Date, channel: string, force?: boolean) => createAction({
    type: SCHEDULE_ACTION,
    payload: { action, date: forDate, channel, force }
});

export const addSessionToGroup = (session: string, group: string) => createAction({
    type: ADD_SESSION_TO_GROUP,
    payload: { session, group }
});

export const removeSessionFromGroup = (session: string, group: string) => createAction({
    type: REMOVE_SESSION_FROM_GROUP,
    payload: { session, group }
});

export const setSessionMetadata = (session: string, value: any) => createAction({
    type: SET_SESSION_METADATA,
    payload: { session, value }
});

export const setSessionMetadataEntry = (session: string, key: string, value: any) => createAction({
    type: SET_SESSION_METADATA,
    payload: { session, key, value }
});

export const unsetSessionMetadataEntry = (session: string, key: string) => createAction({
    type: UNSET_SESSION_METADATA,
    payload: { session, key }
});

export const statChangedNotification = (client: string, sinceDate: Date, group: string, stat: string, channel: string) => createAction({
    type: STATISTIC_CHANGE_NOTIFICATION,
    client,
    payload: { sinceDate, group, stat, channel }
});

export const scheduleStatChangedNotification = (client: string, group: string, stat: string, delayMinutes: number = STAT_CHANGE_NOTIF_DELAY_MINUTES) => {
    const date = moment().add(delayMinutes, 'minutes').toDate();
    return scheduleAction(
        statChangedNotification(client, new Date, group, stat, 'universe_launch_2019'),
        date, `stat-change:${group}:${stat}:${client}`
    )
};