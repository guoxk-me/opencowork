import { ActionType, } from './ActionSchema';
export function validateAction(action) {
    const errors = [];
    // 验证基础字段
    if (!action.id) {
        errors.push('Action must have an id');
    }
    if (!action.type) {
        errors.push('Action must have a type');
    }
    // 根据类型验证参数
    switch (action.type) {
        case ActionType.BROWSER_NAVIGATE:
            return validateNavigate(action, errors);
        case ActionType.BROWSER_CLICK:
            return validateClick(action, errors);
        case ActionType.BROWSER_INPUT:
            return validateInput(action, errors);
        case ActionType.BROWSER_WAIT:
            return validateWait(action, errors);
        case ActionType.BROWSER_EXTRACT:
            return validateExtract(action, errors);
        case ActionType.BROWSER_SCREENSHOT:
            return validateScreenshot(action, errors);
        case ActionType.CLI_EXECUTE:
            return validateCLI(action, errors);
        case ActionType.ASK_USER:
            return validateAskUser(action, errors);
        default:
            errors.push(`Unknown action type: ${action.type}`);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
function validateNavigate(action, errors) {
    if (!action.params.url) {
        errors.push('browser:navigate requires url parameter');
    }
    else if (!isValidUrl(action.params.url)) {
        errors.push('browser:navigate url must be a valid http/https URL');
    }
    return { valid: errors.length === 0, errors };
}
function validateClick(action, errors) {
    if (!action.params.selector) {
        errors.push('browser:click requires selector parameter');
    }
    if (action.params.index !== undefined && action.params.index < 0) {
        errors.push('browser:click index must be non-negative');
    }
    return { valid: errors.length === 0, errors };
}
function validateInput(action, errors) {
    if (!action.params.selector) {
        errors.push('browser:input requires selector parameter');
    }
    if (action.params.text === undefined) {
        errors.push('browser:input requires text parameter');
    }
    return { valid: errors.length === 0, errors };
}
function validateWait(action, errors) {
    if (!action.params.selector && !action.params.timeout) {
        errors.push('browser:wait requires either selector or timeout parameter');
    }
    return { valid: errors.length === 0, errors };
}
function validateExtract(action, errors) {
    if (!action.params.selector) {
        errors.push('browser:extract requires selector parameter');
    }
    if (!['text', 'html', 'table', 'json'].includes(action.params.type)) {
        errors.push('browser:extract type must be one of: text, html, table, json');
    }
    return { valid: errors.length === 0, errors };
}
function validateScreenshot(action, errors) {
    // screenshot 暂无必需参数
    return { valid: errors.length === 0, errors };
}
function validateCLI(action, errors) {
    if (!action.params.command) {
        errors.push('cli:execute requires command parameter');
    }
    return { valid: errors.length === 0, errors };
}
function validateAskUser(action, errors) {
    if (!action.params.question) {
        errors.push('ask:user requires question parameter');
    }
    return { valid: errors.length === 0, errors };
}
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
