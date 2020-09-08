import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	Command,
} from 'vscode-languageserver';

import {
	TextDocument,
} from 'vscode-languageserver-textdocument';
import { FORMERR } from 'dns';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. 
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});


let noteItems: CompletionItem[] = [];

function generateNoteCompletionItems() {
	let notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#',  'a', 'a#', 'b'];

	for (const key in notes) {
		noteItems.push(
			{
				label: notes[key],
				insertText: notes[key],
				kind: CompletionItemKind.Text,			
				detail: "note " + notes[key]
			},
		)
	}

	let octaves = ['1', '2', '3', '4', '5', '6', '7'];
	let durations = ['1', '2', '2*', '4', '4*', '8', '8*', '16', '16*', '32', '32*'];

	for (const n in notes) {
		for (const o in octaves) {
			for (const d in durations) {
				let str = notes[n] + '_' + octaves[o] + '_' + durations[d];
				noteItems.push(
					{
						label: str,
						insertText: str,
						kind: CompletionItemKind.Text,			
						detail: "note " + notes[n] + ' in octave ' + octaves[o] + ' with duration ' + durations[d]
					},
				)
			}
		}	
	}


}

connection.onInitialized(() => {
	generateNoteCompletionItems();
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface ExampleSettings {
	maxNumberOfProblems: number;
}

const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let settings = await getDocumentSettings(textDocument.uri);

	let text = textDocument.getText();
	let reserved_literals_pattern = /let\s*((c|d|e|f|g|a|b)(#)?(_[1-7]_(1|4|8|16|32))?)\b/gm;
	let m: RegExpExecArray | null;
    
	let diagnostics: Diagnostic[] = [];
	//todo validate let statements
	//validate arguments


	while ( m = reserved_literals_pattern.exec(text)) {
		let index = m.index + 4;
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(index),
				end: textDocument.positionAt(index + m[1].length)
			},
			message: "cannot assign to a reserved note literal " + m[1].toString(),
			source: 'soundbytes'
		};
		diagnostics.push(diagnostic);
	}

	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		return noteItems.concat(
			[
				{
					label: 'play();',
					insertText: 'play();',
					kind: CompletionItemKind.Text,
					data: 1,
					command: Command.create("cursorMove", "cursorMove", {to: 'left', by: 'character', value: 2}),
					detail: 'builtin function for playing notes',									
				},
				{
					label: 'tempo();',
					insertText: 'tempo();',
					kind: CompletionItemKind.Text,			
					data: 2,
					command: Command.create("cursorMove", "cursorMove", {to: 'left', by: 'character', value: 2}),
					detail: 'builtin function for setting the song tempo'											
				},
			]
		);
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();