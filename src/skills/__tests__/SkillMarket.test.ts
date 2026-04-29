import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillLoader } from '../skillLoader';
import { SkillMarket } from '../skillMarket';

function writeSkill(dir: string, name: string, version: string, description: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\nversion: ${version}\n---\n\n# ${name}\n`,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version, author: 'OpenCowork' }, null, 2),
    'utf-8'
  );
}

describe('SkillMarket', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('marks a skill as update available when a newer version exists in another source', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-market-'));
    const baseDir = path.join(tempDir, 'skills');
    writeSkill(path.join(baseDir, 'agent-created', 'tasker'), 'tasker', '1.0.0', 'Original tasker');
    writeSkill(path.join(baseDir, 'market', 'tasker'), 'tasker', '1.2.0', 'Updated tasker');

    const market = new SkillMarket(baseDir, new SkillLoader([baseDir]));
    const skills = await market.listInstalledSkills('agent-created');

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('tasker');
    expect(skills[0].updateAvailable).toBe(true);
  });

  it('syncs a skill from the newest available copy on update', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-market-'));
    const baseDir = path.join(tempDir, 'skills');
    writeSkill(path.join(baseDir, 'agent-created', 'tasker'), 'tasker', '1.0.0', 'Original tasker');
    writeSkill(path.join(baseDir, 'market', 'tasker'), 'tasker', '1.2.0', 'Updated tasker');

    const loader = new SkillLoader([baseDir]);
    const market = new SkillMarket(baseDir, loader);

    const result = await market.updateSkill('tasker');
    expect(result.success).toBe(true);

    loader.clearCache();
    const skill = await market.getSkillInfo('tasker');

    expect(skill?.version).toBe('1.2.0');
    expect(skill?.description).toBe('Updated tasker');
  });
});
