"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
let client;
function activate(context) {
    let serverModule = context.asAbsolutePath(path.join('extension', 'out', 'server.js'));
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    let clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'soundbytes' }],
        synchronize: {
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.sb')
        },
        outputChannelName: 'SoundBytes Language Server',
    };
    client = new vscode_languageclient_1.LanguageClient('SoundBytes language Server', 'SoundBytes language Server', serverOptions, clientOptions);
    client.start();
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map