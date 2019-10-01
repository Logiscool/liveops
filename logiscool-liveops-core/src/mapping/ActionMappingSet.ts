import {ActionMapping, SerializedActionMapping} from "./ActionMapping";
import {LiveOpsActionType} from "../LiveOpsAction";

export interface SerializedActionMappingSet {
    mappings: SerializedActionMapping[]
}

export class ActionMappingSet {
    private readonly lookupTable: Record<string, ActionMapping> = {};
    private mappings: ActionMapping[] = [];

    constructor(input: SerializedActionMappingSet = { mappings: [] }) {
        this.mappingSet(input)
    }

    private addMappingToLookupTable(mapping: ActionMapping) {
        for(let action of mapping.actions) {
            this.lookupTable[action] = mapping
        }
    }

    serialize(): SerializedActionMappingSet {
        return {
            mappings: this.mappings.map(mapping => mapping.serialize())
        }
    }

    mappingSet(input: SerializedActionMappingSet): ActionMappingSet {
        this.mappings.push(...input.mappings.map(mapping => {
            const entry = new ActionMapping(mapping);
            this.addMappingToLookupTable(entry);
            return entry
        }));

        return this
    }

    mapping(action: string, rule: string): ActionMappingSet;
    mapping(action: string, rules: string[]): ActionMappingSet;
    mapping(actions: string, rules: string[]|string): ActionMappingSet;
    mapping(actions: string[], rules: string[]): ActionMappingSet;
    mapping(actions: string[], rule: string): ActionMappingSet;
    mapping(mapping: SerializedActionMapping): ActionMappingSet;
    mapping(mapping: ActionMapping): ActionMappingSet;
    mapping(actionOrMapping: string|string[]|SerializedActionMapping|ActionMapping, rule?: string|string[]): ActionMappingSet {
        let mapping: ActionMapping;
        if(actionOrMapping instanceof ActionMapping) {
            mapping = actionOrMapping
        }
        else if(typeof actionOrMapping === 'object' && !Array.isArray(actionOrMapping)) {
            mapping = new ActionMapping(actionOrMapping)
        }
        else if(rule) {
            const actions = Array.isArray(actionOrMapping) ? actionOrMapping : [ actionOrMapping ];
            const rules = Array.isArray(rule) ? rule : [ rule ];
            mapping = new ActionMapping({ actions, rules })
        }
        else {
            throw new Error('Invalid arguments provided for mapping')
        }

        this.addMappingToLookupTable(mapping);
        this.mappings.push(mapping);
        return this
    }

    tryApply(action: { type: string|LiveOpsActionType }) {
        const mapping = this.lookupTable[action.type.toString()];
        if(mapping) return mapping.apply(action);
        return false
    }
}