import {ActionMappingRule} from "./ActionMappingRule";

export interface SerializedActionMapping {
    actions: string[]
    rules: string[]
}

export class ActionMapping {
    readonly actions: string[];
    private rules: ActionMappingRule[];
    private mapper: (action: any) => string[];

    constructor(mapping: SerializedActionMapping) {
        this.actions = mapping.actions;

        if(!mapping.rules.length) {
            throw new Error('Each mapping requires at least one rule.')
        }

        this.rules = mapping.rules.map(rule => new ActionMappingRule(rule))
    }

    static forCustomMapper(action: string|string[], mapper: (action: any) => string[]) {
        const actions = Array.isArray(action) ? action : [ action ];
        const mapping = new ActionMapping({ actions, rules: [ 'dummy' ] });
        mapping.rules = [];
        mapping.mapper = mapper;
        return mapping
    }

    serialize(): SerializedActionMapping {
        if(this.mapper) {
            throw new Error('Serializing a mapping with a custom mapper is not supported.')
        }

        return {
            actions: this.actions,
            rules: this.rules.map(rule => rule.template)
        }
    }

    apply(action: any) {
        if(this.mapper) return this.mapper(action);
        return this.rules.map(rule => rule.apply(action))
    }
}