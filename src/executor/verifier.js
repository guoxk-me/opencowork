/**
 * 验证层
 * 位置: src/executor/verifier.ts
 *
 * 功能: 验证每个action执行结果
 * 类型: URL变化/DOM稳定/元素状态/输入值
 */
import { VerificationType } from '../types/verifier';
export class Verifier {
    page;
    previousUrl = '';
    constructor(page) {
        this.page = page;
    }
    /**
     * 验证action执行结果 - 改进版
     * 区分可恢复和不可恢复的执行失败
     */
    async verify(action, result) {
        this.previousUrl = this.page.url();
        if (!result.success) {
            const isRecoverable = result.error?.recoverable ?? true;
            if (isRecoverable) {
                return {
                    verified: true,
                    type: VerificationType.DOM_STABLE,
                    message: `Action failed but recoverable: ${result.error?.message}`,
                };
            }
            else {
                return {
                    verified: false,
                    type: VerificationType.DOM_STABLE,
                    message: `Action failed and unrecoverable: ${result.error?.message}`,
                };
            }
        }
        switch (action.type) {
            case 'browser:navigate':
                return this.verifyNavigate(action);
            case 'browser:click':
                return this.verifyClick(action, result);
            case 'browser:input':
                return this.verifyInput(action, result);
            case 'browser:wait':
                return this.verifyWait(action);
            default:
                return { verified: true, type: VerificationType.DOM_STABLE };
        }
    }
    async verifyNavigate(action) {
        const currentUrl = this.page.url();
        const expectedUrl = action.params.url;
        let urlMatched = false;
        try {
            const currentOrigin = new URL(currentUrl).origin;
            const expectedOrigin = new URL(expectedUrl).origin;
            urlMatched = currentUrl.includes(expectedUrl) || currentOrigin === expectedOrigin;
        }
        catch {
            urlMatched = currentUrl.includes(expectedUrl);
        }
        return {
            verified: urlMatched,
            type: VerificationType.URL_CHANGE,
            expected: expectedUrl,
            actual: currentUrl,
            message: urlMatched ? 'Navigation successful' : `Expected ${expectedUrl}, got ${currentUrl}`,
        };
    }
    async verifyClick(action, result) {
        const currentUrl = this.page.url();
        const urlChanged = currentUrl !== this.previousUrl;
        if (urlChanged) {
            return { verified: true, type: VerificationType.URL_CHANGE, actual: currentUrl };
        }
        const stable = await this.waitForDOMStable(1500);
        return {
            verified: stable,
            type: VerificationType.DOM_STABLE,
            message: stable ? 'DOM stable after click' : 'DOM still changing after click',
        };
    }
    async verifyInput(action, result) {
        const { selector, text } = action.params;
        try {
            const element = this.page.locator(selector).first();
            const actualValue = await element.inputValue().catch(() => '');
            const verified = actualValue.length > 0;
            return {
                verified,
                type: VerificationType.ELEMENT_CONTAINS,
                expected: text,
                actual: actualValue,
                message: verified ? 'Input successful' : `Expected value, got "${actualValue}"`,
            };
        }
        catch (error) {
            return { verified: false, type: VerificationType.ELEMENT_VISIBLE, message: error.message };
        }
    }
    async verifyWait(action) {
        const { selector, state = 'visible' } = action.params;
        if (!selector) {
            const stable = await this.waitForDOMStable(1000);
            return { verified: stable, type: VerificationType.DOM_STABLE };
        }
        try {
            const element = this.page.locator(selector);
            const isVisible = await element.isVisible().catch(() => false);
            const isHidden = await element.isHidden().catch(() => false);
            const verified = state === 'visible' ? isVisible : isHidden;
            return {
                verified,
                type: state === 'visible' ? VerificationType.ELEMENT_VISIBLE : VerificationType.ELEMENT_HIDDEN,
                message: verified
                    ? `Element ${selector} is ${state}`
                    : `Element ${selector} is not ${state}`,
            };
        }
        catch (error) {
            return { verified: false, type: VerificationType.ELEMENT_VISIBLE, message: error.message };
        }
    }
    async waitForDOMStable(timeout = 1500) {
        const start = Date.now();
        let previousLength = 0;
        let stableCount = 0;
        while (Date.now() - start < timeout) {
            const currentLength = await this.page.evaluate(() => document.body.children.length);
            if (currentLength === previousLength) {
                stableCount++;
                if (stableCount >= 2)
                    return true;
            }
            else {
                stableCount = 0;
            }
            previousLength = currentLength;
            await this.page.waitForTimeout(200);
        }
        return stableCount >= 2;
    }
    recordPreviousUrl() {
        this.previousUrl = this.page.url();
    }
}
