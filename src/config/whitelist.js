export const CLI_WHITELIST = {
    commands: {
        git: {
            allowed: ['status', 'pull', 'push', 'clone', 'log', 'diff'],
            blockedArgs: ['--force', '-f'],
        },
        npm: {
            allowed: ['install', 'run', 'test', 'start', 'build'],
            blockedArgs: ['--force', '-f'],
        },
        python: {
            allowed: ['-c', '-m', '.py'],
            blockedArgs: [],
        },
        curl: {
            allowed: ['-X GET', '-H', '-d', '--max-time'],
            blockedArgs: ['-f'],
        },
        node: {
            allowed: ['.js'],
            blockedArgs: [],
        },
        ls: {
            allowed: ['-la', '-l', '-a'],
            blockedArgs: [],
        },
        pwd: {
            allowed: [],
            blockedArgs: [],
        },
        echo: {
            allowed: ['*'],
            blockedArgs: [],
        },
    },
    paths: {
        '~/Documents': 'read-write',
        '~/Downloads': 'read-write',
        '/tmp': 'read-write',
        '/usr/bin': 'execute-only',
    },
    network: {
        allowedHosts: ['api.github.com', 'api.openai.com'],
        blockedPorts: [22, 3389, 3306, 5432],
    },
    blacklist: [
        'rm -rf',
        'dd',
        'mkfs',
        ':(){:|:&};:',
        'chmod -R 777',
    ],
};
export function isCommandAllowed(command) {
    const cmd = command.trim().split(/\s+/)[0];
    return cmd in CLI_WHITELIST.commands;
}
export function isArgsBlocked(command, args) {
    const cmd = command.trim().split(/\s+/)[0];
    const whitelist = CLI_WHITELIST.commands[cmd];
    if (!whitelist)
        return true;
    for (const blocked of whitelist.blockedArgs) {
        if (args.includes(blocked)) {
            return true;
        }
    }
    return false;
}
export function isPathAllowed(path) {
    const normalizedPath = path.replace(/^~/, process.env.HOME || '/home/user');
    return Object.keys(CLI_WHITELIST.paths).some((allowed) => normalizedPath.startsWith(allowed.replace(/^~/, process.env.HOME || '/home/user')));
}
export function isHostAllowed(host) {
    return CLI_WHITELIST.network.allowedHosts.some((allowed) => {
        if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            return host.endsWith(domain);
        }
        return host === allowed;
    });
}
export function isPortBlocked(port) {
    return CLI_WHITELIST.network.blockedPorts.includes(port);
}
export function isBlacklisted(command) {
    const lowerCommand = command.toLowerCase();
    return CLI_WHITELIST.blacklist.some((blocked) => lowerCommand.includes(blocked.toLowerCase()));
}
