#!/usr/bin/env node

import { commandInit } from './commands/init.js';
import { commandClassField } from './commands/class-field.js';
import { commandList } from './commands/list.js';
import { commandShow } from './commands/show.js';
import { commandDelete } from './commands/delete.js';
import { commandStatus } from './commands/status.js';
import { commandDiff } from './commands/diff.js';
import { commandRefs } from './commands/refs.js';
import { commandView } from './commands/view.js';
import { commandLogin } from './commands/login.js';
import { commandLogout } from './commands/logout.js';
import { commandPush } from './commands/push.js';
import { commandPull } from './commands/pull.js';
import { commandLink } from './commands/link.js';
import { commandShare } from './commands/share.js';
import { commandSetup } from './commands/setup.js';
import { commandUpdate } from './commands/update.js';
import { commandOrg } from './commands/org.js';
import { commandValidate } from './commands/validate.js';
import { commandTree } from './commands/tree.js';
import { commandRead, commandWrite } from './commands/read-write.js';
import { commandConfig } from './commands/config.js';
import { msg } from './lib/messages.js';

const GLOBAL_COMMANDS = ['init', 'setup', 'update', 'list', 'show', 'delete', 'status', 'diff', 'refs', 'validate', 'view', 'login', 'logout', 'push', 'pull', 'link', 'share', 'org', 'read', 'write', 'tree', 'config', 'help'];

function printHelp(): void {
  process.stdout.write(msg('help') + '\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v' || args[0] === 'version') {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    process.stdout.write(`omm ${pkg.version}\n`);
    return;
  }

  const cmd = args[0];

  switch (cmd) {
    case 'init':
      commandInit();
      return;

    case 'setup':
      await commandSetup(args.slice(1));
      return;

    case 'update':
      await commandUpdate();
      return;

    case 'list':
      commandList();
      return;

    case 'tree':
      commandTree(args[1]);
      return;

    case 'config':
      commandConfig(args.slice(1));
      return;

    case 'read':
      commandRead(args[1], args[2]);
      return;

    case 'write':
      await commandWrite(args[1], args[2], args.slice(3));
      return;

    case 'show':
      if (!args[1]) {
        process.stderr.write(msg('usage', { usage: 'omm show <path>' }) + '\n');
        process.exit(1);
      }
      commandShow(args[1]);
      return;

    case 'delete':
      if (!args[1]) {
        process.stderr.write(msg('usage', { usage: 'omm delete <path>' }) + '\n');
        process.exit(1);
      }
      commandDelete(args[1]);
      return;

    case 'status':
      commandStatus();
      return;

    case 'diff':
      if (!args[1]) {
        process.stderr.write(msg('usage', { usage: 'omm diff <path>' }) + '\n');
        process.exit(1);
      }
      commandDiff(args[1]);
      return;

    case 'validate':
      commandValidate(args[1]);
      return;

    case 'refs': {
      let reverse = false;
      let className = args[1];
      if (args[1] === '--reverse') {
        reverse = true;
        className = args[2];
      }
      if (!className) {
        process.stderr.write(msg('usage', { usage: 'omm refs [--reverse] <path>' }) + '\n');
        process.exit(1);
      }
      commandRefs(className, reverse);
      return;
    }

    case 'view': {
      let port = 3000;
      if (args[1] === '--port' && args[2]) {
        port = parseInt(args[2], 10);
        if (isNaN(port)) {
          process.stderr.write(msg('invalidPort') + '\n');
          process.exit(1);
        }
      }
      commandView(port);
      return;
    }

    case 'login':
      await commandLogin();
      return;

    case 'logout':
      commandLogout();
      return;

    case 'link':
      await commandLink(args[1]);
      return;

    case 'push':
      await commandPush();
      return;

    case 'pull':
      await commandPull();
      return;

    case 'share':
      commandShare();
      return;

    case 'org':
      await commandOrg(args[1], args[2]);
      return;

    default:
      // Legacy alias: omm <path> <field> [content] → read/write
      if (args.length >= 2 && !GLOBAL_COMMANDS.includes(cmd)) {
        const targetPath = cmd;
        const field = args[1];
        if (args.length >= 3) {
          await commandWrite(targetPath, field, args.slice(2));
        } else {
          commandRead(targetPath, field);
        }
        return;
      }

      process.stderr.write(msg('unknownCommand', { cmd }) + '\n');
      process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(msg('error', { message: err.message }) + '\n');
  process.exit(1);
});
