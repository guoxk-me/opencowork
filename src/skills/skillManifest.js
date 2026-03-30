import * as yaml from 'js-yaml';
export function parseSkillFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return {
            frontmatter: {},
            body: content,
        };
    }
    const [, yamlStr, body] = match;
    let frontmatter = {};
    try {
        const parsed = yaml.load(yamlStr);
        if (parsed && typeof parsed === 'object') {
            frontmatter = normalizeFrontmatter(parsed);
        }
    }
    catch (error) {
        console.warn('[SkillManifest] Failed to parse YAML frontmatter:', error);
        return {
            frontmatter: {},
            body: content,
        };
    }
    return { frontmatter, body };
}
function normalizeFrontmatter(parsed) {
    const frontmatter = {};
    for (const [key, value] of Object.entries(parsed)) {
        switch (key) {
            case 'name':
            case 'description':
            case 'argumentHint':
                frontmatter[key] = typeof value === 'string' ? value : String(value);
                break;
            case 'shell':
                if (value === 'bash' || value === 'powershell') {
                    frontmatter.shell = value;
                }
                break;
            case 'disableModelInvocation':
            case 'userInvocable':
                frontmatter[key] = typeof value === 'boolean' ? value : value === 'true';
                break;
            case 'allowedTools':
            case 'paths':
                if (Array.isArray(value)) {
                    frontmatter[key] = value.map((v) => String(v));
                }
                break;
            case 'context':
                if (value === 'fork') {
                    frontmatter.context = 'fork';
                }
                break;
            case 'agent':
                if (value === 'Explore' || value === 'Plan' || value === 'general-purpose') {
                    frontmatter.agent = value;
                }
                break;
            case 'effort':
                if (value === 'low' || value === 'medium' || value === 'high' || value === 'max') {
                    frontmatter.effort = value;
                }
                break;
            case 'triggers':
                if (Array.isArray(value)) {
                    const triggers = [];
                    for (const trigger of value) {
                        if (typeof trigger === 'object' && trigger !== null) {
                            const t = trigger;
                            const triggerValue = Array.isArray(t.value) ? t.value.map((v) => String(v)) : [];
                            triggers.push({
                                type: t.type || 'keyword',
                                value: triggerValue,
                                priority: typeof t.priority === 'number' ? t.priority : 50,
                                exclusive: t.exclusive === true,
                            });
                        }
                    }
                    frontmatter.triggers = triggers;
                }
                break;
            case 'openworks-only':
                if (typeof value === 'object' && value !== null) {
                    const ext = value;
                    frontmatter['openworks-only'] = {
                        'max-steps': typeof ext['max-steps'] === 'number' ? ext['max-steps'] : undefined,
                        timeout: typeof ext.timeout === 'number' ? ext.timeout : undefined,
                    };
                }
                break;
            default:
                break;
        }
    }
    return frontmatter;
}
export function validateSkillManifest(manifest) {
    const errors = [];
    if (!manifest.name) {
        errors.push('Skill name is required');
    }
    if (!manifest.description) {
        errors.push('Skill description is recommended');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
