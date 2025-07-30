import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseLLM } from '@langchain/core/language_models/llms';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { assert, NodeConnectionType } from 'n8n-workflow';
import { Stagehand } from '@browserbasehq/stagehand';

export class StagehandNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stagehand',
		name: 'stagehand',
		icon: 'file:stagehand.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Controlla browser utilizzando Stagehand con CDP URL',
		defaults: {
			name: 'Stagehand',
		},
		inputs: [
			NodeConnectionType.Main,
			{
				displayName: 'Model',
				maxConnections: 1,
				type: NodeConnectionType.AiLanguageModel,
				required: false,
			},
		],
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
						name: 'Act',
						value: 'act',
						description: "Esegui un'azione sulla pagina usando linguaggio naturale",
						action: "Esegui un'azione sulla pagina",
					},
					{
						name: 'Extract',
						value: 'extract',
						description: 'Estrai dati strutturati dalla pagina',
						action: 'Estrai dati dalla pagina',
					},
					{
						name: 'Observe',
						value: 'observe',
						description: "Osserva la pagina e pianifica un'azione",
						action: 'Osserva la pagina',
					},
				],
				default: 'act',
			},
			{
				displayName: 'CDP URL',
				name: 'cdpUrl',
				type: 'string',
				default: '',
				placeholder: 'ws://localhost:9222/devtools/browser/...',
				description: 'Chrome DevTools Protocol URL per connettersi al browser',
				required: true,
			},
			// ACT operation
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				placeholder: 'Clicca sul pulsante "Accedi"',
				description: 'Il prompt da eseguire',
				required: true,
				displayOptions: {
					show: {
						operation: ['act'],
					},
				},
			},
			// EXTRACT operation
			{
				displayName: 'Instruction',
				name: 'instruction',
				type: 'string',
				default: '',
				placeholder: 'Estrai il titolo della pagina',
				description: 'Istruzione per estrarre i dati',
				required: true,
				displayOptions: {
					show: {
						operation: ['extract'],
					},
				},
			},
			{
				displayName: 'Schema',
				name: 'schema',
				type: 'json',
				default: '{"title": "string"}',
				description: 'Schema JSON per la struttura dei dati da estrarre',
				displayOptions: {
					show: {
						operation: ['extract'],
					},
				},
			},
			// OBSERVE operation
			{
				displayName: 'Instruction',
				name: 'observeInstruction',
				type: 'string',
				default: '',
				placeholder: 'Trova tutti i pulsanti cliccabili',
				description: 'Istruzione per osservare la pagina',
				required: true,
				displayOptions: {
					show: {
						operation: ['observe'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];
		const model = await this.getInputConnectionData(NodeConnectionType.AiLanguageModel, 0);

		assert(StagehandNode.isChatInstance(model), 'A Chat Model is required');
		assert('model' in model, 'Model is not defined in the input connection data');
		assert('apiKey' in model, 'API Key is not defined in the input connection data');
		assert(typeof model.apiKey === 'string', 'API Key must be a string');

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;
			const cdpUrl = this.getNodeParameter('cdpUrl', i, '') as string;

			const stagehand = new Stagehand({
				env: 'LOCAL',
				modelName: model.lc_namespace[2] + '/' + model.model,
				modelClientOptions: {
					apiKey: model.apiKey,
				},
				localBrowserLaunchOptions: {
					cdpUrl,
				},
			});
			await stagehand.init();

			try {
				switch (operation) {
					case 'act': {
						const prompt = this.getNodeParameter('prompt', i, '') as string;

						results.push({
							json: {
								operation,
								result: await stagehand.page.act(prompt),
							},
						});
						break;
					}

					case 'extract': {
						const instruction = this.getNodeParameter('instruction', i, '') as string;
						const schemaParam = this.getNodeParameter('schema', i, '{}') as string;

						results.push({
							json: {
								operation,
								result: await stagehand.page.extract({
									instruction,
									schema: JSON.parse(schemaParam),
								}),
							},
						});
						break;
					}

					case 'observe': {
						const instruction = this.getNodeParameter('observeInstruction', i, '') as string;

						results.push({
							json: {
								operation,
								result: await stagehand.page.observe(instruction),
							},
						});
						break;
					}

					default: {
						throw new Error(`Operazione non supportata: ${operation}`);
					}
				}
			} finally {
				await stagehand.close();
			}
		}

		return [results];
	}

	static isChatInstance(model: unknown): model is BaseChatModel {
		const namespace = (model as BaseLLM)?.lc_namespace ?? [];

		return namespace.includes('chat_models');
	}
}
