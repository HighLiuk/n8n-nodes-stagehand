import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { chromium } from 'playwright';

export class Playwright implements INodeType {
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
						name: 'Click',
						value: 'click',
						description: 'Click an element matching selector',
						action: 'Click element',
					},
					{
						name: 'Evaluate JS',
						value: 'evaluate',
						description: 'Execute JavaScript in the page context',
						action: 'Evaluate javascript',
					},
					{
						name: 'Fill',
						value: 'fill',
						description: 'Fill an input element',
						action: 'Fill input',
					},
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
						name: 'Press',
						value: 'press',
						description: 'Press a key on an element',
						action: 'Press key',
					},
					{
						name: 'Screenshot',
						value: 'screenshot',
						description: 'Capture a page screenshot',
						action: 'Capture a screenshot',
					},
					{
						name: 'Select Option',
						value: 'selectOption',
						description: 'Select an option in a dropdown',
						action: 'Select option',
					},
					{
						name: 'Type',
						value: 'type',
						description: 'Type text into an element',
						action: 'Type text',
					},
					{
						name: 'Wait For Load State',
						value: 'waitForLoadState',
						description: 'Wait for the page to load completely',
						action: 'Wait for page load',
					},
					{
						name: 'Wait For Selector',
						value: 'waitForSelector',
						description: 'Wait for a selector to appear',
						action: 'Wait for selector',
					},
					{
						name: 'Wait For Timeout',
						value: 'waitForTimeout',
						description: 'Wait for a specified duration',
						action: 'Wait duration',
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
			// COMMON selector
			{
				displayName: 'Selector',
				name: 'selector',
				type: 'string',
				default: '',
				placeholder: 'css=button#submit',
				description: 'Playwright selector of the element',
				required: true,
				displayOptions: {
					show: {
						operation: ['click', 'fill', 'type', 'press', 'selectOption', 'waitForSelector'],
					},
				},
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'Text to enter',
				required: true,
				displayOptions: {
					show: {
						operation: ['fill', 'type'],
					},
				},
			},
			{
				displayName: 'Key',
				name: 'key',
				type: 'string',
				default: 'Enter',
				description: 'Keyboard key to press',
				required: true,
				displayOptions: {
					show: {
						operation: ['press'],
					},
				},
			},
			{
				displayName: 'Option Value',
				name: 'value',
				type: 'string',
				default: '',
				description: 'Value of the option to select',
				required: true,
				displayOptions: {
					show: {
						operation: ['selectOption'],
					},
				},
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				options: [
					{
						name: 'Load',
						value: 'load',
						description: 'Wait for the load event',
					},
					{
						name: 'DOM Content Loaded',
						value: 'domcontentloaded',
						description: 'Wait for the DOMContentLoaded event',
					},
					{
						name: 'Network Idle',
						value: 'networkidle',
						description: 'Wait until there are no network connections for at least 500 ms',
					},
				],
				default: 'load',
				description: 'The state to wait for before proceeding',
				displayOptions: {
					show: {
						operation: ['waitForLoadState'],
					},
				},
			},
			{
				displayName: 'Duration (Ms)',
				name: 'duration',
				type: 'number',
				default: 1000,
				typeOptions: {
					minValue: 0,
				},
				description: 'Time to wait',
				required: true,
				displayOptions: {
					show: {
						operation: ['waitForTimeout'],
					},
				},
			},
			// EVALUATE operation
			{
				displayName: 'Script',
				name: 'script',
				type: 'string',
				default: '',
				description: 'JavaScript code to execute in the browser context',
				required: true,
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						operation: ['evaluate'],
					},
				},
			},
			// ADVANCED OPTIONS
			{
				displayName: 'Advanced Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				description: 'Advanced options for Playwright actions',
				options: [
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						type: 'number',
						default: 30000,
						typeOptions: {
							minValue: 0,
						},
						description: 'Maximum time to wait for the operation to complete',
					},
				],
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
			const timeout = this.getNodeParameter('options.timeout', i, 30000) as number;
			const browser = await chromium.connectOverCDP(cdpUrl);
			const context = browser.contexts()[0] ?? (await browser.newContext());
			const page = context.pages()[0] ?? (await context.newPage());

			try {
				switch (operation) {
					case 'goto': {
						const url = this.getNodeParameter('url', i, '') as string;

						await page.goto(url, { timeout });

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
							timeout,
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

					case 'click': {
						const selector = this.getNodeParameter('selector', i, '') as string;

						await page.click(selector, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'fill':
					case 'type': {
						const selector = this.getNodeParameter('selector', i, '') as string;
						const text = this.getNodeParameter('text', i, '') as string;

						await page.fill(selector, text, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'selectOption': {
						const selector = this.getNodeParameter('selector', i, '') as string;
						const value = this.getNodeParameter('value', i, '') as string;

						await page.selectOption(selector, value, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'press': {
						const selector = this.getNodeParameter('selector', i, '') as string;
						const key = this.getNodeParameter('key', i, 'Enter') as string;

						await page.press(selector, key, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'waitForTimeout': {
						const duration = this.getNodeParameter('duration', i, 1000) as number;

						await page.waitForTimeout(duration);

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'waitForSelector': {
						const selector = this.getNodeParameter('selector', i, '') as string;

						await page.waitForSelector(selector, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'waitForLoadState': {
						const state = this.getNodeParameter('state', i, 'load') as string;

						if (state !== 'load' && state !== 'domcontentloaded' && state !== 'networkidle') {
							throw new ApplicationError(`Unsupported load state: ${state}`);
						}

						await page.waitForLoadState(state, { timeout });

						results.push({
							json: {
								operation,
							},
						});
						break;
					}

					case 'evaluate': {
						const script = this.getNodeParameter('script', i, '') as string;

						await page.evaluate(script, { timeout });

						results.push({
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
			} catch (error) {
				results.push({
					error: new NodeOperationError(this.getNode(), error as Error, {
						message: 'Failed to execute Playwright operation',
					}),
					json: {},
				});
			} finally {
				await browser.close();
			}
		}

		return [results];
	}
}
