import * as request from 'request-promise-native';
import {TokenProvider} from "./token-provider";
import {RequestError} from "request-promise-native/errors";
const debug = require('debug')('logiscool-liveops:api');

export interface ListResult<TResult = any> {
    totalCount: number
    page: number
    limit: number
    items: TResult[]
}

export class ApiBase {
    root = process.env.GATEWAY;
    protected readonly tokenProvider: TokenProvider;

    constructor(tokenProvider: TokenProvider) {
        this.tokenProvider = tokenProvider
    }

    get token() {
        return this.tokenProvider.token()
    }

    private uri(command: string) {
        return `${this.root}${command}`;
    }

    private querystringWithToken(qs: Record<string, any> = {}) {
        return { ...qs, access_token: this.token }
    }

    private handleCatch(name: string, fallback: any) {
        return (e: RequestError) => {
            debug(name, e.error);
            return fallback
        }
    }

    protected get<TResult = any>(name: string, command: string, qs?: Record<string, any>, fallbackValue: any = false, verb = 'GET'): Promise<TResult> {
        return request({
            method: verb,
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: true
        }).catch(this.handleCatch(name, fallbackValue))
    }

    protected list<TResult = any>(name: string, command: string, qs?: Record<string, any>, fallbackValue: any = [], verb = 'GET'): Promise<TResult[]> {
        return request({
            method: verb,
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: true
        }).catch(this.handleCatch(name, fallbackValue))
    }

    protected async listWithTotalCount<TResult = any>(name: string, command: string,
                                                        qs: { page: number, limit: number } & Record<string, any>,
                                                        fallbackValue: any = []): Promise<ListResult<TResult>> {
        try {
            const response = await request({
                method: 'GET',
                uri: this.uri(command),
                qs: this.querystringWithToken(qs),
                resolveWithFullResponse: true,
                json: true
            });

            return {
                totalCount: response.headers['X-Total-Count'],
                page: qs.page,
                limit: qs.limit,
                items: typeof response.body === 'string' ? JSON.parse(response.body) : response.body
            }
        }
        catch(e) {
            return this.handleCatch(name, fallbackValue)(e)
        }
    }

    protected create<TResult = any>(name: string, command: string, qs?: Record<string, any>, body?: any, fallbackValue: any = false): Promise<TResult> {
        return request({
            method: 'POST',
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: body
        }).catch(this.handleCatch(name, fallbackValue))
    }

    protected patch<TResult = any>(name: string, command: string, qs?: Record<string, any>, body?: any, fallbackValue: any = false): Promise<TResult> {
        return request({
            method: 'PATCH',
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: body
        }).catch(this.handleCatch(name, fallbackValue))
    }

    protected update<TResult = any>(name: string, command: string, qs?: Record<string, any>, body?: any, fallbackValue: any = false): Promise<TResult> {
        return request({
            method: 'PUT',
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: body
        }).catch(this.handleCatch(name, fallbackValue))
    }

    protected delete(name: string, command: string, qs?: Record<string, any>, fallbackValue: any = false) {
        return request({
            method: 'DELETE',
            uri: this.uri(command),
            qs: this.querystringWithToken(qs),
            json: true
        }).catch(this.handleCatch(name, fallbackValue))
    }
}