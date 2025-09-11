import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import {
	ChatMessageContent,
	CreateChatCompletionOptions,
	LLMClient,
	Stagehand,
} from '@browserbasehq/stagehand';

export class CdpTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CDP Tools',
		name: 'cdpTools',
		icon: 'file:chrome.svg',
		group: ['transform'],
		version: 1,
		description: 'Get information from a web page using Chrome DevTools Protocol',
		defaults: {
			name: 'CDP Tools',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'CDP URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'ws://localhost:9222/devtools/browser/...',
				description: 'Chrome DevTools Protocol URL to connect to the browser',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const cdpUrl = this.getNodeParameter('url', i, '') as string;

			let tree = await getAccessibilityTree(cdpUrl);
			const nodesMap = await getNodesMap(cdpUrl, tree);
			const matches = tree.matchAll(/\[((?:\d+-)?\d+)\] /g);

			let j = 0;
			let offset = 0;
			const xpaths = [];
			for (const match of matches) {
				const before = tree.slice(0, match.index + offset);
				const after = tree.slice(match.index + match[0].length + offset);
				const replace = `[${j}] `;
				offset += replace.length - match[0].length;
				tree = `${before}${replace}${after}`;
				xpaths.push(nodesMap[match[1]]);
				j++;
			}

			results.push({
				json: {
					accessibilityTree: tree,
					xpaths,
				},
			});

			continue;
		}

		return [results];
	}
}

/**
 * Get the accessibility tree from the page.
 */
async function getAccessibilityTree(cdpUrl: string): Promise<string> {
	let prompt: ChatMessageContent;
	const stagehand = new Stagehand({
		env: 'LOCAL',
		domSettleTimeoutMs: 0,
		modelClientOptions: {
			apiKey: 'test',
		},
		localBrowserLaunchOptions: {
			cdpUrl,
		},
		llmClient: {
			createChatCompletion({ options }: CreateChatCompletionOptions) {
				prompt = options.messages[1].content;
				throw 'Intentional error to stop execution';
			},
		} as unknown as LLMClient,
	});
	await stagehand.init();

	const { page } = stagehand;
	try {
		await page.observe('');
	} catch {
	} finally {
		await stagehand.close();
	}

	return prompt!.toString().split('Accessibility Tree: \n')[1].trim();
}

/**
 * Get the nodes map from the page.
 */
async function getNodesMap(cdpUrl: string, tree: string): Promise<Record<string, string>> {
	const stagehand = new Stagehand({
		env: 'LOCAL',
		domSettleTimeoutMs: 0,
		modelClientOptions: {
			apiKey: 'test',
		},
		localBrowserLaunchOptions: {
			cdpUrl,
		},
		llmClient: {
			createChatCompletion() {
				const matches = tree.matchAll(/\[((?:\d+-)?\d+)\] /g);

				return {
					data: {
						elements: [...matches]
							.filter((match) => match[1].includes('-'))
							.map((match) => ({
								elementId: match[1],
								description: match[1],
								method: '',
								arguments: [],
							})),
					},
					usage: {
						prompt_tokens: 0,
						completion_tokens: 0,
						total_tokens: 0,
					},
				};
			},
		} as unknown as LLMClient,
	});
	await stagehand.init();

	const { page } = stagehand;
	try {
		const results = await page.observe('x');
		await stagehand.close();
		return results.reduce(
			(acc, result) => {
				acc[result.description] = result.selector;
				return acc;
			},
			{} as Record<string, string>,
		);
	} catch {
	} finally {
		await stagehand.close();
	}

	return {};
}
