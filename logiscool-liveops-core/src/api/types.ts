import {PushNotification} from "../store/models";

export interface LiveOpsSession {
    user: string,
    sessionId: string,
    segments: string[],
    groups: string[],
    metadata: any,
    expireAt: Date,
    createdAt: Date
}

export interface UserKind {
    administrator: boolean
    contributor: boolean
    developer: boolean
    leadTeacher: boolean
    mixer: boolean
    parent: boolean
    schoolCoordinator: boolean
    scoolcode: boolean
    student: boolean
    teacher: boolean
    translator: boolean
    agent: boolean
}

export interface User {
    id: string
    username: string
    email: string
    fullName: string
    displayName: string
    profileImg: string
    kind: UserKind
    locale: string
}

export interface StoredNotification {
    createdAt: Date;
    read: boolean;
    message: PushNotification
}