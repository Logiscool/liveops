const parse = require('obj-parse');

function parseTemplate(template: string) {
    let parsingParam = false;
    let paramCandidate = '';
    const params = [];
    for(let char of template) {
        if(char === '{') {
            if(parsingParam) throw new Error('Invalid template string: invalid param name');
            parsingParam = true
        }
        else if(parsingParam) {
            if(char === '}') {
                if (!paramCandidate) throw new Error('Invalid template string: empty param name');
                params.push({ name: paramCandidate, getter: parse(paramCandidate) });
                paramCandidate = '';
                parsingParam = false
            }
            else {
                paramCandidate += char
            }
        }
    }
    return params
}

export class ActionMappingRule {
    readonly template: string;
    readonly params: { name: string, getter: (obj: any) => any }[];

    constructor(template: string) {
        if(!template || !template.trim()) {
            throw new Error('Invalid template string: empty template');
        }

        this.template = template;
        this.params = parseTemplate(template)
    }

    apply = (action: any) => {
        let output = this.template;
        for(let { name, getter } of this.params) {
            output = output.replace(`{${name}}`, getter(action))
        }
        return output
    }
}