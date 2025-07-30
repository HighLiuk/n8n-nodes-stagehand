import { PlaywrightNode } from './nodes/playwright/Playwright.node';
import { StagehandNode } from './nodes/stagehand/Stagehand.node';

export { PlaywrightNode, StagehandNode };

module.exports = {
	Playwright: PlaywrightNode,
	Stagehand: StagehandNode,
};
