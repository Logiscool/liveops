export interface PushNotificationAction {
    action?: string
    title?: string
    icon?: string
}

export type PushProvider = 'push'|'in-app';
export type PushDisplayType = 'slide-in'|'fancy'|'super-fancy'|'normal';

export interface PushNotification {
    title: string
    body?: string
    badge?: string
    actions?: PushNotificationAction[]
    data: {
        type: string,
        display: PushDisplayType
        payload: any
    }
    dir?: 'auto'|'ltr'|'rtl'
    icon?: string
    image?: string
    lang?: string
    tag?: string
    renotify?: boolean
    requireInteraction?: boolean
    silent?: boolean
    timestamp?: number
    vibrate?: number[]
}

export interface SendNotificationPayload {
    channel: string
    providers?: PushProvider[]
    broadcast?: boolean
    target?: string
    targets?: string[]
    persistent: boolean
    message: PushNotification
}