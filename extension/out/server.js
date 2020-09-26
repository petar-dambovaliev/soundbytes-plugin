"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
// Create a simple text document manager. 
let documents = new vscode_languageserver_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
            },
            signatureHelpProvider: {
                triggerCharacters: ["vib", "track", "play", "tempo"]
            },
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
connection.onSignatureHelp((a, b, c, d) => {
    return {
        signatures: [
            vscode_languageserver_1.SignatureInformation.create("play", "play", vscode_languageserver_1.ParameterInformation.create("argument 1", "documentation 1")),
        ],
        activeParameter: 1,
        activeSignature: 1,
    };
});
let noteItems = [];
function generateNoteCompletionItems() {
    let notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    for (const key in notes) {
        noteItems.push({
            label: notes[key],
            insertText: notes[key],
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            detail: "note " + notes[key]
        });
    }
    let octaves = ['1', '2', '3', '4', '5', '6', '7'];
    let durations = ['1', '2', '2*', '4', '4*', '8', '8*', '16', '16*', '32', '32*'];
    for (const n in notes) {
        for (const o in octaves) {
            for (const d in durations) {
                let str = notes[n] + '_' + octaves[o] + '_' + durations[d];
                noteItems.push({
                    label: str,
                    insertText: str,
                    kind: vscode_languageserver_1.CompletionItemKind.Text,
                    detail: "note " + notes[n] + ' in octave ' + octaves[o] + ' with duration ' + durations[d]
                });
            }
        }
    }
    noteItems.push({
        label: 'x',
        insertText: 'x',
        kind: vscode_languageserver_1.CompletionItemKind.Text,
        detail: "pause with inherited duration"
    });
    for (const d in durations) {
        let str = 'x_' + durations[d];
        noteItems.push({
            label: str,
            insertText: str,
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            detail: "pause with duration " + durations[d]
        });
    }
}
connection.onInitialized(() => {
    generateNoteCompletionItems();
    if (hasConfigurationCapability) {
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
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
async function validateTextDocument(textDocument) {
    let settings = await getDocumentSettings(textDocument.uri);
    let text = textDocument.getText();
    let reserved_literals_pattern = /let\s*(((c|d|e|f|g|a|b)(#)?(_[1-7]_(1|4|8|16|32))?)|tempo|play|track|vib)\b/gm;
    let m;
    let diagnostics = [];
    //todo validate let statements
    //validate function arguments
    while (m = reserved_literals_pattern.exec(text)) {
        let index = m.index + 4;
        let diagnostic = {
            severity: vscode_languageserver_1.DiagnosticSeverity.Error,
            range: {
                start: textDocument.positionAt(index),
                end: textDocument.positionAt(index + m[1].length)
            },
            message: "cannot assign to a reserved literal " + m[1].toString(),
            source: 'soundbytes'
        };
        diagnostics.push(diagnostic);
    }
    // let all idents
    let match_let = /let\s*([a-z][\w#]*)/gm;
    let ml;
    let match_ident = /([a-z][\w#]*)/gmi;
    let l;
    let vars = [];
    vars['play'] = true;
    vars['tempo'] = true;
    vars['track'] = true;
    vars['vib'] = true;
    let exprs = text.split(/\n/);
    let char = 0;
    for (const k in noteItems) {
        vars[noteItems[k].label] = true;
    }
    for (const k in exprs) {
        let ex = exprs[k].split(";");
        for (const i in ex) {
            if (ex[i][0] === "/" && ex[i][1] == "/") {
                char += ex[i].length + 1;
                continue;
            }
            if (ml = match_let.exec(ex[i])) {
                char += ex[i].length + 1;
                //connection.console.log(ml[1]);
                vars[ml[1]] = true;
                continue;
            }
            while (l = match_ident.exec(ex[i])) {
                if (vars[l[0]] == undefined) {
                    let index = l.index + char;
                    let diagnostic = {
                        severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                        range: {
                            start: textDocument.positionAt(index),
                            end: textDocument.positionAt(index + l[0].length)
                        },
                        message: l[0].toString() + " is not defined",
                    };
                    diagnostics.push(diagnostic);
                }
            }
            char += ex[i].length + 1;
        }
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onCompletion((_textDocumentPosition) => {
    return noteItems.concat([
        {
            label: 'play();',
            insertText: 'play();',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            command: vscode_languageserver_1.Command.create("cursorMove", "cursorMove", { to: 'left', by: 'character', value: 2 }),
            detail: 'play notes|tracks',
        },
        {
            label: 'tempo();',
            insertText: 'tempo();',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            command: vscode_languageserver_1.Command.create("cursorMove", "cursorMove", { to: 'left', by: 'character', value: 2 }),
            detail: 'set the song tempo'
        },
        {
            label: 'vib',
            insertText: 'vib();',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            command: vscode_languageserver_1.Command.create("cursorMove", "cursorMove", { to: 'left', by: 'character', value: 2 }),
            detail: 'add vibrato to notes'
        },
        {
            label: 'let',
            insertText: 'let ',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            detail: 'declare a variable'
        },
    ]);
});
connection.onCompletionResolve((item) => {
    return item;
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map