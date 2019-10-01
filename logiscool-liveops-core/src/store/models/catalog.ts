export interface Price {
    value: number
    currency: 'gem'|'coin'
}

export interface CatalogItem {
    id: string,
    name: string
    price: Price
    limited: boolean
    singleton: boolean
    count: number
    catalog: string
}

export interface Catalog {
    name: string
    items: CatalogItem[]
}