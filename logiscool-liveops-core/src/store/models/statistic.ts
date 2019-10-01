export interface StatisticName {
    group: string,
    stat: string,
    version?: string
}

export interface Statistic extends StatisticName {
    value: number
}
