import * as names from '../store/constants';
import {LiveOpsActionType} from "../LiveOpsAction";
import {ChangeNumericValuePayload, SetNumericValuePayload} from "../helpers";
import {Catalog, Statistic, StatisticName, InventoryItem} from "../store/models";
import {
    ActionWithFollowUp,
    LeaderboardEntry,
    SendNotificationPayload,
    StoredNotification,
    User,
    PushNotification,
    PushProvider
} from "..";

export const SET_CURRENCY = new LiveOpsActionType<SetNumericValuePayload & { currency: string }>(names.SET_CURRENCY);
export const SET_CURRENCY_REFILL = new LiveOpsActionType<{ currency: string, refillsAt: Date|null }>(names.SET_CURRENCY_REFILL);
export const SET_STATISTIC = new LiveOpsActionType<Statistic & { target?: string }>(names.SET_STATISTIC);

export const CHANGE_CURRENCY = new LiveOpsActionType<ChangeNumericValuePayload & { currency: string }>(names.CHANGE_CURRENCY);
export const CHANGE_CAPACITY = new LiveOpsActionType<ChangeNumericValuePayload & { id: string, item: string, catalog: string }>(names.CHANGE_CAPACITY);
export const CHANGE_INVENTORY = new LiveOpsActionType<ChangeNumericValuePayload & { id: string, item: string }>(names.CHANGE_INVENTORY);
export const CHANGE_STATISTIC = new LiveOpsActionType<ChangeNumericValuePayload & StatisticName & { target?: string }>(names.CHANGE_STATISTIC);
export const CHANGE_STATISTIC_TO = new LiveOpsActionType<Statistic & { target?: string, allowDecrement?: boolean }>(names.CHANGE_STATISTIC_TO);

export const CREATE_SUBSCRIPTION = new LiveOpsActionType<{ channel: string, subscriptionObject: any }>(names.CREATE_SUBSCRIPTION);

export const REQUEST_STATISTIC = new LiveOpsActionType<StatisticName>(names.REQUEST_STATISTIC);
export const REQUEST_STATISTICS = new LiveOpsActionType<{ statistics: StatisticName[] }>(names.REQUEST_STATISTICS);
export const STATISTIC = new LiveOpsActionType<Statistic>(names.STATISTIC);

export const REQUEST_CATALOG = new LiveOpsActionType<{ catalog: string }>(names.REQUEST_CATALOG);
export const CATALOG = new LiveOpsActionType<{ catalog: Catalog }>(names.CATALOG);

export const REQUEST_INVENTORY = new LiveOpsActionType<{}>(names.REQUEST_INVENTORY);
export const INVENTORY = new LiveOpsActionType<{ inventory: InventoryItem[] }>(names.INVENTORY);
export const ADD_TO_INVENTORY = new LiveOpsActionType<{ item: InventoryItem }>(names.ADD_TO_INVENTORY);

export const REQUEST_LEADERBOARD = new LiveOpsActionType<StatisticName>(names.REQUEST_LEADERBOARD);
export const LEADERBOARD = new LiveOpsActionType<StatisticName & { items: LeaderboardEntry[] }>(names.LEADERBOARD);
export const LEADERBOARD_RANK = new LiveOpsActionType<StatisticName & { rank: number|null, value: number }>(names.LEADERBOARD_RANK);

export const SEND_NOTIFICATION = new LiveOpsActionType<SendNotificationPayload>(names.SEND_NOTIFICATION);
export const PUSH_NOTIFICATION =  new LiveOpsActionType<{ channel: string, notification: StoredNotification }>(names.PUSH_NOTIFICATION);
export const REQUEST_NOTIFICATIONS = new LiveOpsActionType<{ channel: string }>(names.REQUEST_NOTIFICATIONS);
export const NOTIFICATIONS = new LiveOpsActionType<{ channel: string, notifications: StoredNotification[] }>(names.NOTIFICATIONS);
export const READ_NOTIFICATIONS = new LiveOpsActionType<{ channel: string }>(names.READ_NOTIFICATIONS);
export const READ_NOTIFICATION = new LiveOpsActionType<{ id: string }>(names.READ_NOTIFICATION);
export const STATISTIC_CHANGE_NOTIFICATION = new LiveOpsActionType<StatisticName & { sinceDate: Date, channel: string }>(names.STATISTIC_CHANGE_NOTIFICATION);
export const REQUEST_SEND_NOTIFICATION = new LiveOpsActionType<{ account_filter: string, channel: string, message: PushNotification, persistent?: boolean, providers?: PushProvider[] }>(names.REQUEST_SEND_NOTIFICATION);

export const SCHEDULE_ACTION = new LiveOpsActionType<{ channel: string, date: Date, action: ActionWithFollowUp, force?: boolean }>(names.SCHEDULE_ACTION);

export const ADD_SESSION_TO_GROUP = new LiveOpsActionType<{ session: string, group: string }>(names.ADD_SESSION_TO_GROUP);
export const REMOVE_SESSION_FROM_GROUP = new LiveOpsActionType<{ session: string, group: string }>(names.REMOVE_SESSION_FROM_GROUP);
export const SET_SESSION_METADATA = new LiveOpsActionType<{ session: string, key?: string, value: any }>(names.SET_SESSION_METADATA);
export const UNSET_SESSION_METADATA = new LiveOpsActionType<{ session: string, key: string }>(names.UNSET_SESSION_METADATA);
export const SESSION_GROUP_UPDATE = new LiveOpsActionType<{ session: string, groups: string[] }>(names.SESSION_GROUP_UPDATE);
export const SESSION_METADATA_UPDATE = new LiveOpsActionType<{ session: string, account: string, metadata: any }>(names.SESSION_METADATA_UPDATE);
export const ACCOUNT_GROUP_UPDATE = new LiveOpsActionType<{ session: string, account: string, groups: string[] }>(names.ACCOUNT_GROUP_UPDATE);

export const CONNECT = new LiveOpsActionType<{ account: User, session: string }>('SERVER/CONNECT');
export const DISCONNECT = new LiveOpsActionType<{ accountId: string, session: string, goneOffline: boolean }>('SERVER/DISCONNECT');

