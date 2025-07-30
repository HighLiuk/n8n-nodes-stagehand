import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionType } from 'n8n-workflow';
import { chromium } from 'playwright';

export class PlaywrightNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Playwright',
		name: 'playwright',
		icon: 'file:playwright.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Control browser using Playwright directly with CDP URL',
		defaults: {
			name: 'Playwright',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Executable Path',
						value: 'executablePath',
						description: 'Get the Chromium executable path',
						action: 'Get executable path',
					},
					{
						name: 'Goto',
						value: 'goto',
						description: 'Navigate to a specific URL',
						action: 'Navigate to a URL',
					},
					{
						name: 'Screenshot',
						value: 'screenshot',
						description: 'Capture a page screenshot',
						action: 'Capture a screenshot',
					},
				],
				default: 'executablePath',
			},
			{
				displayName: 'CDP URL',
				name: 'cdpUrl',
				type: 'string',
				default: '',
				placeholder: 'ws://localhost:9222/devtools/browser/...',
				description: 'Chrome DevTools Protocol URL to connect to the browser',
				required: true,
				displayOptions: {
					hide: {
						operation: ['executablePath'],
					},
				},
			},
			// GOTO operation
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://example.com',
				description: 'The URL to navigate to',
				required: true,
				displayOptions: {
					show: {
						operation: ['goto'],
					},
				},
			},
			// SCREENSHOT operation
			{
				displayName: 'Full Page',
				name: 'fullPage',
				type: 'boolean',
				default: false,
				description: 'Whether to capture the full page instead of just the viewport',
				displayOptions: {
					show: {
						operation: ['screenshot'],
					},
				},
			},
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'number',
				default: 80,
				typeOptions: {
					minValue: 0,
					maxValue: 100,
				},
				description: 'Screenshot quality (0-100, JPEG only)',
				displayOptions: {
					show: {
						operation: ['screenshot'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'executablePath') {
				results.push({
					json: {
						operation,
						result: chromium.executablePath(),
					},
				});
				continue;
			}

			// For other operations, connect to browser
			const cdpUrl = this.getNodeParameter('cdpUrl', i, '') as string;
			const browser = await chromium.connectOverCDP(cdpUrl);
			const context = browser.contexts()[0] ?? (await browser.newContext());
			const page = context.pages()[0] ?? (await context.newPage());

			try {
				switch (operation) {
					case 'goto': {
						const url = this.getNodeParameter('url', i, '') as string;

						await page.goto(url);

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'screenshot': {
						const fullPage = this.getNodeParameter('fullPage', i, false) as boolean;
						const quality = this.getNodeParameter('quality', i, 80) as number;

						const screenshot = await page.screenshot({
							fullPage,
							quality,
							type: 'jpeg',
						});

						results.push({
							binary: {
								screenshot: await this.helpers.prepareBinaryData(
									Buffer.from(screenshot),
									'screenshot.jpg',
									'image/jpeg',
								),
							},
							json: {
								operation,
							},
						});
						break;
					}

					default: {
						throw new ApplicationError(`Unsupported operation: ${operation}`);
					}
				}
			} finally {
				await browser.close();
			}
		}

		return [results];
	}
}
