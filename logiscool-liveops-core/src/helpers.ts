import {ActionWithFollowUp, ActionWithSubscription, AnyPayload, LiveOpsActionType, SET_CURRENCY} from "./";
const uuid = require('uuid/v4');

export function getTransaction(action: ActionWithSubscription) {
    if(action.meta) return action.meta.transaction || null;
    return null
}

export function setTransaction(action: ActionWithSubscription, baseAction?: ActionWithSubscription|string) {
    action.meta = action.meta || {};
    action.meta.transaction = typeof baseAction === 'string'
        ? baseAction
        : (baseAction && baseAction.meta && baseAction.meta.transaction)
            ? baseAction.meta.transaction
            : uuid()
}

export interface ChangeNumericValuePayload {
    amount: number
}

export function changeNumericValue(client: string|null, target: string, amount: number, extraPayload: any = {}) {
    const type = `SERVER/CHANGE_${target.toUpperCase()}`;
    return {
        type,
        client,
        payload: { amount, ...extraPayload },
        revert: { type, client, payload: { amount: -amount, ...extraPayload } }
    }
}

export interface SetNumericValuePayload {
    prevValue: number
    value: number
}

export function setNumericValue(client: string|null, target: string, prevValue: number, value: number, extraPayload: any = {}) {
    const type = `SERVER/SET_${target.toUpperCase()}`;
    return {
        type,
        client,
        payload: { prevValue, value, ...extraPayload },
        revert: { type, client, payload: { prevValue: value, value: prevValue, ...extraPayload } }
    }
}

export function transaction(mainAction: ActionWithFollowUp, ...actions: ActionWithFollowUp[]) {
    let current = mainAction;
    setTransaction(mainAction);
    while (actions.length) {
        current.next = actions.shift();
        current = current.next as any
    }
    return mainAction
}

export interface StatusPayload {
    status: 'begin'|'done'|'error'
    error?: string
}

export function revert(session: string, type: string) {
    return {
        type,
        session,
        payload: { status: 'error', error: 'transaction_failure' },
        status: true,
        error: true
    }
}

export function statusBegin(session: string, type: string) {
    return {
        type,
        session,
        payload: { status: 'begin' },
        revert: revert(session, type),
        status: true
    }
}

export function statusEnd(session: string, type: string) {
    return {
        type,
        session,
        payload: { status: 'done' },
        status: true
    }
}

export function transactionWithStatus(session: string, type: LiveOpsActionType|string, mainAction: ActionWithFollowUp, ...actions: ActionWithFollowUp[]) {
    type = type.toString();
    return transaction(
        statusBegin(session, type),
        mainAction,
        ...actions,
        statusEnd(session, type)
    )
}

export function createAction<TPayload = AnyPayload>(action: ActionWithFollowUp<TPayload>): ActionWithFollowUp<TPayload> {
    return { ...action, type: action.type.toString() }
}