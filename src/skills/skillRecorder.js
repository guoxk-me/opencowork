/**
 * SkillRecorder - 录制 Agent 执行过程并生成 Skill
 * 用于将成功执行的操作录制为可复用的 Skill
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSkillRunner } from './skillRunner';
let skillRecorderInstance = null;
export class SkillRecorder {
    isRecording = false;
    currentSkillName = null;
    currentDescription = '';
    recordedSteps = [];
    startTime = 0;
    skillRunner = getSkillRunner();
    isCurrentlyRecording() {
        return this.isRecording;
    }
    getCurrentSkillName() {
        return this.currentSkillName;
    }
    /**
     * 开始录制
     */
    startRecording(skillName, description = '') {
        if (this.isRecording) {
            return {
                success: false,
                message: `已经在录制 "${this.currentSkillName}"，请先完成录制`,
            };
        }
        this.isRecording = true;
        this.currentSkillName = skillName;
        this.currentDescription = description;
        this.recordedSteps = [];
        this.startTime = Date.now();
        console.log(`[SkillRecorder] Started recording skill: ${skillName}`);
        return {
            success: true,
            message: `开始录制 Skill: ${skillName}`,
        };
    }
    /**
     * 记录一个执行步骤
     */
    recordStep(toolName, args, result) {
        if (!this.isRecording) {
            return;
        }
        const step = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            toolName,
            args,
            result,
            timestamp: Date.now(),
        };
        this.recordedSteps.push(step);
        console.log(`[SkillRecorder] Recorded step: ${toolName}`);
    }
    /**
     * 完成录制并生成 Skill
     */
    async finishRecording(triggers) {
        if (!this.isRecording) {
            return {
                success: false,
                message: '当前没有在录制',
            };
        }
        if (!this.currentSkillName) {
            return {
                success: false,
                message: '录制信息不完整',
            };
        }
        const skillName = this.currentSkillName;
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        console.log(`[SkillRecorder] Finishing recording: ${skillName}, steps: ${this.recordedSteps.length}`);
        try {
            const skillContent = this.generateSkillContent(skillName);
            const skillPath = await this.saveSkill(skillName, skillContent, triggers);
            this.isRecording = false;
            this.currentSkillName = null;
            this.currentDescription = '';
            this.recordedSteps = [];
            this.startTime = 0;
            console.log(`[SkillRecorder] Skill saved to: ${skillPath}`);
            return {
                success: true,
                message: `Skill "${skillName}" 录制完成！已保存到 ${skillPath}`,
                skillPath,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[SkillRecorder] Failed to save skill:`, error);
            this.isRecording = false;
            this.currentSkillName = null;
            this.recordedSteps = [];
            this.startTime = 0;
            return {
                success: false,
                message: `保存 Skill 失败: ${errorMessage}`,
            };
        }
    }
    /**
     * 生成 SKILL.md 内容
     */
    generateSkillContent(skillName) {
        const description = this.currentDescription || `${skillName} - 自动录制的 Skill`;
        let content = `# ${skillName}\n\n`;
        content += `${description}\n\n`;
        content += `## 执行步骤\n\n`;
        for (let i = 0; i < this.recordedSteps.length; i++) {
            const step = this.recordedSteps[i];
            content += `### 步骤 ${i + 1}: ${step.toolName}\n`;
            content += `- 时间: ${new Date(step.timestamp).toISOString()}\n`;
            if (step.args && Object.keys(step.args).length > 0) {
                content += `- 参数: \`${JSON.stringify(step.args)}\`\n`;
            }
            if (step.result) {
                content += `- 结果: \`${JSON.stringify(step.result).substring(0, 200)}\`\n`;
            }
            content += '\n';
        }
        content += `---\n`;
        content += `*此 Skill 由 SkillRecorder 自动生成，录制时间: ${new Date().toISOString()}*\n`;
        return content;
    }
    /**
     * 保存 Skill 到磁盘
     */
    async saveSkill(skillName, content, triggers) {
        const skillsDir = path.join(process.env.HOME || '/root', '.opencowork', 'skills', skillName);
        fs.mkdirSync(skillsDir, { recursive: true });
        const skillMdContent = this.generateSKILLMd(skillName, content, triggers);
        const skillMdPath = path.join(skillsDir, 'SKILL.md');
        fs.writeFileSync(skillMdPath, skillMdContent, 'utf-8');
        const packageJsonPath = path.join(skillsDir, 'package.json');
        const packageJson = {
            name: skillName,
            version: '1.0.0',
            description: this.currentDescription || `${skillName} skill`,
        };
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
        console.log(`[SkillRecorder] Skill files written to: ${skillsDir}`);
        return skillsDir;
    }
    /**
     * 生成标准 SKILL.md 格式
     */
    generateSKILLMd(skillName, content, triggers) {
        const description = this.currentDescription || `${skillName} - 自动录制的 Skill`;
        let yamlFrontmatter = '---\n';
        yamlFrontmatter += `name: ${skillName}\n`;
        yamlFrontmatter += `description: ${description}\n`;
        yamlFrontmatter += `triggers:\n`;
        yamlFrontmatter += `  - type: keyword\n`;
        yamlFrontmatter += `    value: [${triggers.map((t) => `'${t}'`).join(', ')}]\n`;
        yamlFrontmatter += `    priority: 80\n`;
        yamlFrontmatter += `shell: bash\n`;
        yamlFrontmatter += '---\n\n';
        yamlFrontmatter += content;
        return yamlFrontmatter;
    }
    /**
     * 获取当前录制的步骤数
     */
    getRecordedStepsCount() {
        return this.recordedSteps.length;
    }
    /**
     * 取消录制
     */
    cancelRecording() {
        if (!this.isRecording) {
            return {
                success: false,
                message: '当前没有在录制',
            };
        }
        const skillName = this.currentSkillName;
        this.isRecording = false;
        this.currentSkillName = null;
        this.currentDescription = '';
        this.recordedSteps = [];
        this.startTime = 0;
        console.log(`[SkillRecorder] Recording cancelled for: ${skillName}`);
        return {
            success: true,
            message: `已取消录制: ${skillName}`,
        };
    }
}
export function getSkillRecorder() {
    if (!skillRecorderInstance) {
        skillRecorderInstance = new SkillRecorder();
    }
    return skillRecorderInstance;
}
